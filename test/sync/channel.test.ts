import { Unit } from '../../src/core/unit';
import { syncData } from '../../src/sync/xsync';
import { xnew, xsync } from '../../src/index';
import { ioMock, bootServer, bootClient, asServer, asClient } from './io-mock';

//----------------------------------------------------------------------------------------------------
// イベントチャンネル（socket.io transport: boot / emit / on）
//   - client.emit('move', payload) → server.on('move', (clientId, payload)) へ clientId 付きで届く
//   - boot がルートに socket をバインドし、コンポーネント / handler 内から emit/on を使う
//   - 1 イベントに複数ハンドラ登録可。受信時に closure の state を直接更新する（ポーリング無し）
//   transport は in-memory な socket.io 風モック（test/sync/io-mock）を使う。
//----------------------------------------------------------------------------------------------------

describe('event channel (socket.io transport)', () => {
    let hub: ReturnType<typeof ioMock>;
    beforeEach(() => { jest.useFakeTimers({ now: 0 }); Unit.reset(); hub = ioMock(); });
    afterEach(() => { Unit.engineRoot?.finalize(); jest.useRealTimers(); });

    it('boot({ socket, room }): wires the transport and auto-generates clientId', () => {
        const received: Array<[string, any]> = [];
        const server = bootServer({ io: hub.io }, function Server(unit: Unit) {
            xsync.server(() => { unit.on('move', ({ id, x }: any) => received.push([id, { x }])); });
        });

        let id1: string | undefined;
        let id2: string | undefined;
        bootClient({ socket: hub.connect() }, function Client(unit: Unit) {
            xsync.client(() => { id1 = xsync.session.myself.id; unit.on('update', () => xsync.emitToServer('move', { x: 1 })); });
        });
        bootClient({ socket: hub.connect() }, function Client(unit: Unit) {
            xsync.client(() => { id2 = xsync.session.myself.id; });
        });

        expect(id1).toBe('c1');   // 自動発番（手動 clientId 不要）
        expect(id2).toBe('c2');

        Unit.update(Unit.engineRoot);   // c1 の client が emit

        expect(received).toEqual([['c1', { x: 1 }]]);
        expect(server).toBeDefined();
    });

    it('updates state directly on message receipt (no polling) via closure', () => {
        let state: Record<string, any> = {};
        bootServer({ io: hub.io }, function Server(unit: Unit) {
            xsync.server(() => {
                state = xsync.state({ x: 0 });
                // 受信時に closure の state を直接更新（inbox 不要）。unit 生成等はしない。
                unit.on('move', ({ dx }: any) => { state.x += dx; });
            });
        });

        const socket = hub.connect();   // 同じ hub の生 client
        // 生 socket から送るときも xsync.emitToServer と同じ封筒（予約 wire 'emitToServer' + { type, data }）で送る。
        socket.emit('emitToServer', { type: 'move', data: { dx: 5 } });
        socket.emit('emitToServer', { type: 'move', data: { dx: 2 } });
        expect(state.x).toBe(7);
    });

    it('full cycle: Player updates its own state on move receipt; World spawns from presence', () => {
        // Player: 自分宛の 'move' を受けたら（tick を待たず）closure の state を直接更新。
        function Player(unit: Unit, props: { clientId?: string } = {}) {
            const state = xsync.state({ x: 0, y: 0, clientId: props.clientId ?? '' });
            xsync.server(() => {
                unit.on('move', ({ id, dx, dy }: any) => {
                    if (id !== state.clientId) { return; }     // 自分宛だけ（無印=全体なので id で絞る）
                    state.x += dx ?? 0;
                    state.y += dy ?? 0;
                });
            });
            xsync.client(() => { xnew.nest('<div>'); });
        }
        // World: 接続集合(presence)を on('sync.connect'/'sync.disconnect') で持ち、spawn/despawn は update(tick内)で行う。
        function World(unit: Unit) {
            xsync.register({ Player });
            // socket は boot に渡した transport により自動バインドされる。
            xsync.server(() => {
                const connected = new Set<string>();
                const players = new Map<string, Unit>();
                unit.on('sync.connect', ({ id }: any) => connected.add(id));
                unit.on('sync.disconnect', ({ id }: any) => connected.delete(id));
                unit.on('update', () => {
                    for (const clientId of connected) {
                        if (!players.has(clientId)) { players.set(clientId, xnew(Player, { clientId }) as unknown as Unit); }
                    }
                    for (const [clientId, player] of [...players.entries()]) {
                        if (!connected.has(clientId)) { player.finalize(); players.delete(clientId); }
                    }
                });
            });
            xsync.client(() => {
                unit.on('update', () => { xsync.emitToServer('move', { dx: 1, dy: 0 }); });
            });
        }

        const view1 = document.createElement('div');
        const view2 = document.createElement('div');

        const server = bootServer({ io: hub.io }, World);                          // on('sync.connect') を登録
        const client1 = bootClient({ socket: hub.connect() }, view1, World); // connect → presence に c1
        const socket2 = hub.connect();
        const client2 = bootClient({ socket: socket2 }, view2, World);        // connect → presence に c2

        // server / client サブツリーを各々の環境で別々に tick する（emit/status は env で分岐するため、
        // 1 回の update で両側をまとめて回さない）。server を先に回して Player を spawn → client が emit。
        // server update が root.on('update') で 'sync' を両 client へ broadcast し、各 client boot が apply する
        // （明示の capture/apply は不要）。
        function cycle() {
            asServer(() => Unit.update(server));                                // server: presence から Player を spawn + 'sync' broadcast → 両 client apply
            asClient(() => { Unit.update(client1); Unit.update(client2); });    // client: on('update') の emit
        }
        cycle();   // f1: server spawn 2 Player（この frame の client emit は Player 登録前なので素通り）
        cycle();   // f2: client emit → 各 Player の on('move') が受信時に state を更新
        cycle();

        const players = hub.lastSync().filter((n: any) => n.name === 'Player');   // 直近に broadcast された tree
        expect(players.length).toBe(2);
        const byClient = Object.fromEntries(players.map((p: any) => [p.state.clientId, p.state]));
        expect(byClient.c1.x).toBeGreaterThanOrEqual(1);
        expect(byClient.c2.x).toBeGreaterThanOrEqual(1);

        // 両 replica が 2 Player を持つ（World 直下に同期生成）
        expect(client1._.children.filter((c: Unit) => syncData(c).state).length).toBe(2);
        expect(client2._.children.filter((c: Unit) => syncData(c).state).length).toBe(2);

        // 切断 → 次フレームで despawn
        socket2.disconnect();
        asServer(() => Unit.update(server));   // server World が切断メンバの Player を despawn + 'sync' broadcast
        expect(hub.lastSync().filter((n: any) => n.name === 'Player').length).toBe(1);
    });

    it('boot auto-wires the down-channel (server broadcast / client apply)', () => {
        function Mover(unit: Unit) {
            const state = xsync.state({ x: 0 });
            xsync.server(() => { unit.on('update', () => { state.x += 1; }); });
        }
        function World(unit: Unit) {
            xsync.register({ Mover });   // 下りの配線（emit('sync')/on('sync')）は boot が自動で行う
            xsync.server(() => { xnew(Mover); });
        }
        const server = bootServer({ io: hub.io }, World);   // boot の自動 mirror が update で broadcast
        const client = bootClient({ socket: hub.connect() }, World);   // boot の自動 mirror が on('sync') で apply

        Unit.update(Unit.engineRoot);   // server Mover が x+=1、World(server) が 'sync' を broadcast → client が apply

        const replica = client._.children.find((c: Unit) => syncData(c).state);
        expect(replica).toBeDefined();
        expect(syncData(replica!).state!.x).toBe(hub.lastSync().find((n: any) => n.name === 'Mover')!.state.x);
        expect(syncData(replica!).state!.x).toBeGreaterThanOrEqual(1);
    });

    it('unit.on sync handler runs in the registering unit scope (inner xnew(...) parents correctly)', () => {
        function Child(_: Unit) {}
        let world!: Unit;
        function World(unit: Unit) {
            world = unit;
            // ハンドラ内で生成した Child は、登録元(World)の子として作られなければならない。
            unit.on('join', ({ id }: any) => xnew(Child, { key: id, clientId: id }));
        }
        bootServer({ io: hub.io }, World);

        // 同じ hub の生 client が join を送ると server の on('join') が発火する（id=clientId）。
        hub.connect('c1').emit('emitToServer', { type: 'join' });

        const child = xnew.find(Child, { key: 'c1' })[0];
        expect(child).toBeDefined();
        expect(child.parent).toBe(world);   // stale な currentUnit でなく World の子
    });

    it("'-event' routes only to the handler whose unit shares the emitter syncId (same component)", () => {
        const hits: string[] = [];
        // server 側: syncId を持つ 2 ユニットが各々 on('-move') を登録。
        function Tagged(unit: Unit, props: { tag?: string; syncId?: number } = {}) {
            syncData(unit).id = props.syncId ?? null;
            xsync.server(() => { unit.on('-move', ({ vector }: any) => hits.push(`${props.tag}:${vector.x}`)); });
        }
        bootServer({ io: hub.io }, function Server() {
            xsync.server(() => { xnew(Tagged, { tag: 'A', syncId: 10 }); xnew(Tagged, { tag: 'B', syncId: 20 }); });
        });

        // client 側: syncId=10 のユニットから '-move' を送ると、同じ syncId の A だけに届く。
        bootClient({ socket: hub.connect() }, function Client(unit: Unit) {
            xsync.client(() => {
                syncData(unit).id = 10;
                xsync.emitToServer('-move', { vector: { x: 1 } });
            });
        });

        expect(hits).toEqual(['A:1']);   // B(syncId=20) には届かない
    });

    it("'+event' routes to all components under the root (regardless of syncId)", () => {
        const hits: string[] = [];
        function Tagged(unit: Unit, props: { tag?: string; syncId?: number } = {}) {
            syncData(unit).id = props.syncId ?? null;
            xsync.server(() => { unit.on('+ping', ({ n }: any) => hits.push(`${props.tag}:${n}`)); });
        }
        bootServer({ io: hub.io }, function Server() {
            xsync.server(() => { xnew(Tagged, { tag: 'A', syncId: 10 }); xnew(Tagged, { tag: 'B', syncId: 20 }); });
        });
        // 送信ユニットの syncId に関係なく、'+ping' は両方のユニットへ届く（全体）。
        bootClient({ socket: hub.connect() }, function Client(unit: Unit) {
            xsync.client(() => { syncData(unit).id = 10; xsync.emitToServer('+ping', { n: 1 }); });
        });

        expect(hits.sort()).toEqual(['A:1', 'B:1']);
    });

    it('client boot dispatches the socket lifecycle into the root as sync.* events with the own id', () => {
        // boot は socket の connect/disconnect/notfound を root 配下へ sync.* として配る（id = 自分の socket id）。
        const handlers = new Map<string, Set<Function>>();
        const socket: any = {
            id: 'c1',
            emit: () => {},
            on: (event: string, h: Function) => { if (!handlers.has(event)) { handlers.set(event, new Set()); } handlers.get(event)!.add(h); },
            off: (event: string, h: Function) => { handlers.get(event)?.delete(h); },   // boot detaches on root finalize
            disconnect: () => {},
        };
        const fire = (event: string, payload?: any) => handlers.get(event)?.forEach((h) => (h as Function)(payload));

        const log: string[] = [];
        bootClient({ socket }, function Client(unit: Unit) {
            unit.on('sync.connect', ({ id }: any) => log.push(`connect:${id}`));
            unit.on('sync.disconnect', ({ id }: any) => log.push(`disconnect:${id}`));
            unit.on('sync.notfound', ({ id, roomId }: any) => log.push(`notfound:${id}:${roomId}`));
        });

        fire('connect');
        fire('notfound', { roomId: 'r1' });
        fire('disconnect');

        expect(log).toEqual(['connect:c1', 'notfound:c1:r1', 'disconnect:c1']);
    });
});
