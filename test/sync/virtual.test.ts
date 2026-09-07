import { Unit } from '../../src/core/unit';
import { xnew, xsync } from '../../src/index';
import { ioMock, bootServer, bootClient, asServer, asClient } from './io-mock';

//----------------------------------------------------------------------------------------------------
// xsync.attach / detach / dispatch — 名簿にソケットの無いメンバーを置く。
//   置かれた側から見ると、線の向こうから来た人と区別が付かない（session.clients に載り、
//   'sync.connect' が飛ぶ）が、線の側では素通しされる: 投影は送られず、そこからは何も届かない。
//   その人のぶんを指すのはサーバー自身で、xsync.dispatch が「その人から届いた 1 通」を流す。
//----------------------------------------------------------------------------------------------------

describe('virtual members (xsync.attach / detach / dispatch)', () => {
    let hub: ReturnType<typeof ioMock>;
    let log: string[];
    let plays: string[];

    beforeEach(() => { jest.useFakeTimers({ now: 0 }); Unit.reset(); hub = ioMock(); log = []; plays = []; });
    afterEach(() => { Unit.engineRoot?.finalize(); jest.useRealTimers(); });

    // 席ごとの持ち物。owner にだけ見える（CPU の分は誰の線にも乗らないことの確認に使う）
    function Hand(unit: Unit, { ownerId = '', card = 0 }: any = {}) {
        xsync.state({ ownerId, card });
        asServer(() => xsync.visibility((clientId) => clientId === ownerId));
        return {};
    }

    // 部屋 1 つぶん。入退室をログに積み、'play' を受ける（人でも CPU でも同じハンドラ）
    function Room(unit: Unit) {
        xsync.register({ Hand });
        asServer(() => {
            unit.on('sync.connect', ({ id }: any) => { log.push(`connect:${id}`); xnew(Hand, { key: id, ownerId: id, card: id === 'cpu1' ? 99 : 1 }); });
            unit.on('sync.disconnect', ({ id }: any) => log.push(`disconnect:${id}`));
            unit.on('play', ({ id, card }: any) => plays.push(`${id}:${card}`));
        });
        return {
            add: (id: string, name?: string) => xsync.attach({ id, name }),
            remove: (id: string) => xsync.detach(id),
            act: (type: string, id: string, props?: any) => xsync.dispatch(type, id, props),
            roster: () => xsync.session.clients.map((client) => client.id),
        };
    }

    type RoomUnit = Unit & {
        add(id: string, name?: string): any;
        remove(id: string): boolean;
        act(type: string, id: string, props?: any): void;
        roster(): string[];
    };

    const boot = (): RoomUnit => bootServer({ io: hub.io }, Room) as RoomUnit;

    it('attach puts the member on the roster and announces it like a connection', () => {
        const room = boot();
        const client = asServer(() => room.add('cpu1', 'CPU 1'));

        expect(client).toEqual({ id: 'cpu1', name: 'CPU 1', virtual: true });
        expect(asServer(() => room.roster())).toEqual(['cpu1']);
        expect(log).toEqual(['connect:cpu1']);
    });

    it('detach takes it back off; a real client is refused (it leaves by disconnecting)', () => {
        const room = boot();
        asServer(() => { room.add('cpu1'); hub.connect('c1'); });

        expect(asServer(() => room.remove('cpu1'))).toBe(true);
        expect(asServer(() => room.roster())).toEqual(['c1']);
        expect(log).toEqual(['connect:cpu1', 'connect:c1', 'disconnect:cpu1']);

        expect(asServer(() => room.remove('c1'))).toBe(false);
        expect(asServer(() => room.remove('nobody'))).toBe(false);
        expect(log).toEqual(['connect:cpu1', 'connect:c1', 'disconnect:cpu1']);   // 断られた分は何も流れない
    });

    it('rejects a duplicate id and an empty one', () => {
        const room = boot();
        asServer(() => room.add('cpu1'));

        expect(() => asServer(() => room.add('cpu1'))).toThrow(/already in this room/);
        expect(() => asServer(() => room.add(''))).toThrow(/needs an id/);
    });

    it('real clients see it in their own roster and get the connect relay', () => {
        const server = bootServer({ io: hub.io }, function Server(unit: Unit) {
            return { add: (id: string, name?: string) => xsync.attach({ id, name }) };
        }) as Unit & { add(id: string, name?: string): any };
        const seen: string[] = [];
        let roster: string[] = [];
        bootClient({ socket: hub.connect('c1') }, function Client(unit: Unit) {
            asClient(() => {
                unit.on('sync.connect', ({ id }: any) => seen.push(id));
                unit.on('sync.status', () => { roster = xsync.session.clients.map((client) => client.id); });
            });
        });

        asServer(() => server.add('cpu1', 'CPU 1'));

        expect(seen).toContain('cpu1');                     // relay された 'sync.connect'
        expect(roster.sort()).toEqual(['c1', 'cpu1']);      // status チャンネルで名簿ごと届く
    });

    it('nothing is projected to it, and its private state never reaches the wire', () => {
        const room = boot();
        asServer(() => { room.add('cpu1'); hub.connect('c1'); });
        asServer(() => Unit.update(Unit.engineRoot));

        expect(hub.syncCountFor('cpu1')).toBe(0);           // ソケットが無いので投影は送らない
        expect(hub.syncCountFor('c1')).toBeGreaterThan(0);

        const tree = hub.lastSyncFor('c1');
        expect(tree.map((node: any) => node.state.ownerId)).toEqual(['c1']);   // CPU の手札は誰にも届かない
    });

    it('dispatch acts for it: the same handler, with its id stamped', () => {
        const room = boot();
        asServer(() => { room.add('cpu1'); room.act('play', 'cpu1', { card: 7 }); });

        expect(plays).toEqual(['cpu1:7']);
    });

    it('dispatch refuses the reserved namespace and anyone who is not a virtual member', () => {
        const room = boot();
        asServer(() => { room.add('cpu1'); hub.connect('c1'); });

        expect(() => asServer(() => room.act('sync.connect', 'cpu1'))).toThrow(/namespace/);
        expect(() => asServer(() => room.act('play', 'c1', { card: 1 }))).toThrow(/not a virtual member/);
        expect(() => asServer(() => room.act('play', 'nobody', { card: 1 }))).toThrow(/not a virtual member/);
        expect(plays).toEqual([]);
    });

    it('is server side only', () => {
        const client = bootClient({ socket: hub.connect('c1') }, function Client(unit: Unit) {
            return {
                add: () => xsync.attach({ id: 'cpu1' }),
                remove: () => xsync.detach('cpu1'),
                act: () => xsync.dispatch('play', 'cpu1'),
            };
        }) as Unit & { add(): any, remove(): any, act(): any };

        expect(() => asClient(() => client.add())).toThrow(/server side/);
        expect(() => asClient(() => client.remove())).toThrow(/server side/);
        expect(() => asClient(() => client.act())).toThrow(/server side/);
    });
});
