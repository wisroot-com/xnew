import { Unit } from '../../src/core/unit';
import { xnew, xsync } from '../../src/index';
import { Lobby, Room, setEnvironment } from '../../src/sync/xsync';

// boot 対象の client ツリー（client 側でペインを nest する）。
function World(unit: Unit) {
    xsync.client(() => { xnew.nest('<div>'); });
}

// socket.io 互換の最小モック socket。fire でイベントを擬似発火する（onAny は connect/disconnect を含まない）。
function mockSocket() {
    const handlers = new Map<string, Set<Function>>();
    const anyHandlers = new Set<Function>();
    return {
        id: 's1',
        connected: false,
        emit: jest.fn(),
        on(event: string, h: Function) { if (!handlers.has(event)) { handlers.set(event, new Set()); } handlers.get(event)!.add(h); },
        off(event: string, h: Function) { handlers.get(event)?.delete(h); },
        onAny(h: Function) { anyHandlers.add(h); },
        offAny(h: Function) { anyHandlers.delete(h); },
        disconnect: jest.fn(),
        fire(event: string, payload?: any) {
            handlers.get(event)?.forEach((h) => h(payload));
            if (event !== 'connect' && event !== 'disconnect') { anyHandlers.forEach((h) => h(event, payload)); }
        },
    };
}

describe('Lobby', () => {
    beforeEach(() => { jest.useFakeTimers(); Unit.reset(); });
    afterEach(() => { Unit.engineRoot?.finalize(); jest.useRealTimers(); document.body.innerHTML = ''; });

    it("forwards socket events to the host unit as '-events'", () => {
        const socket = mockSocket();
        const log: string[] = [];
        xnew(function Host(unit: Unit) {
            xnew.extend(Lobby, { io: () => socket });
            unit.on('-connect', () => log.push('connect'));
            unit.on('-statusupdate', ({ rooms }: any) => log.push(`rooms:${rooms.length}`));
            unit.on('-disconnect', () => log.push('disconnect'));
        });

        socket.fire('connect');
        socket.fire('statusupdate', { rooms: [1, 2, 3] });
        socket.fire('disconnect');

        expect(log).toEqual(['connect', 'rooms:3', 'disconnect']);
    });

    it('disconnects the socket and stops forwarding on finalize', () => {
        const socket = mockSocket();
        const log: string[] = [];
        const host = xnew(function Host(unit: Unit) {
            xnew.extend(Lobby, { io: () => socket });
            unit.on('-connect', () => log.push('connect'));
        });

        host.finalize();
        expect(socket.disconnect).toHaveBeenCalledTimes(1);

        socket.fire('connect');   // ハンドラ解除済みなので host へは届かない
        expect(log).toEqual([]);
    });

    it('exposes createRoom(name) on the host unit that emits create', () => {
        const socket = mockSocket();
        const host = xnew(function Host() { xnew.extend(Lobby, { io: () => socket }); });
        (host as any).createRoom('my room');
        expect(socket.emit).toHaveBeenCalledWith('roomcreate', { name: 'my room' });
    });
});

// in-memory な socket.io 風 io（server 側）。複数の connection リスナ・'lobby' room への broadcast を支える。
// （src の socketio アダプタもこの io に connection リスナを張るので、ルーム接続もそのまま処理される。）
function lobbyIo() {
    const onConnection = new Set<(s: any) => void>();
    const lobby = new Set<any>();   // 'lobby' に join した conn 群
    return {
        on(event: string, h: (s: any) => void) { if (event === 'connection') { onConnection.add(h); } },
        off(event: string, h: (s: any) => void) { if (event === 'connection') { onConnection.delete(h); } },
        to(room: string) { return { emit: (event: string, payload?: any) => { if (room === 'lobby') { lobby.forEach((c) => c._recv(event, payload)); } } }; },
        emit() {},   // 全体 broadcast（このテストでは未使用）
        _connect(conn: any) { onConnection.forEach((h) => h(conn)); },
        _lobby: lobby,
        get connectionCount() { return onConnection.size; },
    };
}

let connSeq = 0;
// 接続してくる socket のモック。handshake.query.roomId でロビー/ルーム接続を切り替える。
//   server→client: emit/_recv で受信（conn.sent に記録）。client→server: _emit で on(event)+onAny を発火。
//   _leave: client 切断（adapter の on('disconnect') を発火）。
function lobbyConn(io: ReturnType<typeof lobbyIo>, roomId?: string) {
    const handlers = new Map<string, Set<Function>>();
    const anyHandlers = new Set<Function>();
    const on = (event: string, h: Function) => { if (!handlers.has(event)) { handlers.set(event, new Set()); } handlers.get(event)!.add(h); };
    const conn: any = {
        id: 'c' + (++connSeq),
        handshake: { query: roomId !== undefined ? { roomId } : {} },
        sent: [] as any[],
        join(room: string) { if (room === 'lobby') { io._lobby.add(conn); } },
        emit(event: string, payload?: any) { conn.sent.push([event, payload]); },   // server→client(direct)
        on,
        onAny(h: Function) { anyHandlers.add(h); },                                  // socketio アダプタ用
        disconnect: jest.fn(),
        _recv(event: string, payload?: any) { conn.sent.push([event, payload]); },   // server broadcast→client
        _emit(event: string, payload?: any) { handlers.get(event)?.forEach((h) => h(payload)); anyHandlers.forEach((h) => h(event, payload)); },
        _leave() { handlers.get('disconnect')?.forEach((h) => h()); },
        rooms() { const m = [...conn.sent].reverse().find(([e]: any) => e === 'statusupdate'); return m ? m[1].rooms : undefined; },
    };
    return conn;
}

describe('Lobby (server)', () => {
    beforeEach(() => { setEnvironment('server'); jest.useFakeTimers(); Unit.reset(); });
    afterEach(() => { Unit.engineRoot?.finalize(); jest.useRealTimers(); document.body.innerHTML = ''; setEnvironment(null); });

    // host は basics Lobby を extend し、生成に使う Room コンポーネント（World を中身に据える）を注入する。
    const mountLobby = (io: any, { graceMs, ...lobbyProps }: any = {}) => {
        const GameRoom = (_u: Unit, props: any) => xnew.extend(Room, { ...props, Component: World, graceMs });
        return xnew(function Host() { xnew.extend(Lobby, { io, Room: GameRoom, ...lobbyProps }); });
    };

    it('sends the current (empty) room list to a new lobby connection', () => {
        const io = lobbyIo();
        mountLobby(io);
        const a = lobbyConn(io); io._connect(a);
        expect(a.rooms()).toEqual([]);
    });

    it('creates a room on create: creator gets created and the lobby list updates', () => {
        const io = lobbyIo();
        mountLobby(io);
        const a = lobbyConn(io); io._connect(a);
        a._emit('roomcreate', { name: 'My Room' });
        expect(a.sent).toContainEqual(['roomcreated', { room: { id: 'r1', name: 'My Room', count: 0 } }]);
        expect(a.rooms()).toEqual([{ id: 'r1', name: 'My Room', count: 0 }]);
    });

    it('rejects create beyond maxRooms with rejected', () => {
        const io = lobbyIo();
        mountLobby(io, { maxRooms: 1 });
        const a = lobbyConn(io); io._connect(a);
        a._emit('roomcreate', { name: 'A' });
        a._emit('roomcreate', { name: 'B' });
        expect(a.sent.filter(([e]: any) => e === 'roomcreated')).toHaveLength(1);
        expect(a.sent).toContainEqual(['roomrejected', { message: expect.any(String) }]);
    });

    it('rejects a connection to an unknown room with notfound and disconnect', () => {
        const io = lobbyIo();
        mountLobby(io);
        const ghost = lobbyConn(io, 'ghost'); io._connect(ghost);
        expect(ghost.sent).toContainEqual(['notfound', { roomId: 'ghost' }]);
        expect(ghost.disconnect).toHaveBeenCalled();
    });

    it('counts members and cleans up the empty room after the grace period', () => {
        const io = lobbyIo();
        mountLobby(io, { graceMs: 1000 });
        const a = lobbyConn(io); io._connect(a);
        a._emit('roomcreate', { name: 'R' });        // r1 を作成

        const p = lobbyConn(io, 'r1'); io._connect(p);   // r1 へ参加（adapter が connect を配る）
        expect(a.rooms()).toEqual([{ id: 'r1', name: 'R', count: 1 }]);

        p._leave();                                      // 退出 → count 0
        expect(a.rooms()).toEqual([{ id: 'r1', name: 'R', count: 0 }]);

        jest.advanceTimersByTime(1000);                  // 猶予経過 → 空室は撤去
        expect(a.rooms()).toEqual([]);
    });

    it('removes the connection listener on finalize', () => {
        const io = lobbyIo();
        const host = mountLobby(io);
        expect(io.connectionCount).toBe(1);
        host.finalize();
        expect(io.connectionCount).toBe(0);
    });
});

describe('Room', () => {
    beforeEach(() => { jest.useFakeTimers(); Unit.reset(); });
    afterEach(() => { Unit.engineRoot?.finalize(); jest.useRealTimers(); document.body.innerHTML = ''; setEnvironment(null); });

    it("forwards socket connect/disconnect/notfound to the host unit as '-events'", () => {
        const socket = mockSocket();
        const log: string[] = [];
        xnew(function Scene(unit: Unit) {
            xnew.extend(Room, { io: () => socket, room: { id: 'solo', name: 'solo' }, Component: World });
            // boot が基本イベントを host unit（Scene）の '-event' へ転送する。
            unit.on('-connect', () => log.push('connect'));
            unit.on('-disconnect', () => log.push('disconnect'));
            unit.on('-notfound', ({ roomId }: any) => log.push(`notfound:${roomId}`));
        });

        socket.fire('connect');
        socket.fire('notfound', { roomId: 'r1' });
        socket.fire('disconnect');

        expect(log).toEqual(['connect', 'notfound:r1', 'disconnect']);
    });

    it('boots the component as a client tree', () => {
        const socket = mockSocket();
        xnew(function Scene(_: Unit) { xnew.extend(Room, { io: () => socket, room: { id: 'solo', name: 'solo' }, Component: World }); });
        const [root] = Unit.find(World);   // boot された root の Component は World
        expect((root.element as HTMLElement).tagName).toBe('DIV');   // client 環境: World の client ブロックが nest
        expect(root._.status).not.toBe('finalized');
    });

    it('finalizes the client tree and disconnects the socket on finalize', () => {
        const socket = mockSocket();
        const scene = xnew(function Scene(_: Unit) { xnew.extend(Room, { io: () => socket, room: { id: 'solo', name: 'solo' }, Component: World }); });
        const [root] = Unit.find(World);

        expect(root._.status).not.toBe('finalized');
        scene.finalize();

        expect(socket.disconnect).toHaveBeenCalledTimes(1);
        expect(root._.status).toBe('finalized');
    });

    it('boots in server mode without disconnecting, and finalizes on finalize', () => {
        setEnvironment('server');   // Node 実行を模す（jsdom はそのままだと client 判定）
        const io = mockSocket();
        const scene = xnew(function Scene(_: Unit) { xnew(Room, { io, room: { id: 'solo', name: 'solo' }, Component: World }); });
        const [root] = Unit.find(World);

        expect(root._.status).not.toBe('finalized');

        scene.finalize();   // server 分岐は disconnect を呼ばず booted root を畳むだけ

        expect(root._.status).toBe('finalized');
    });
});
