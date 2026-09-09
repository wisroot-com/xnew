import { Unit } from '../../src/core/unit';
import { xsync } from '../../src/index';
import { ioMock, bootServer, bootClient, asServer, ROOM } from './io-mock';

//----------------------------------------------------------------------------------------------------
// 'sync.connect' / 'sync.disconnect' は名簿の 1 行をそのまま連れてくる（{ id, name, cpu }）。
//   id だけだと、受け取った側は名簿を引くしかない。ところが名簿はどちらの端でも当てにならない:
//     ・出ていった人は announce の時点でもう clients から外れている（サーバー側）
//     ・入ってきた人の relay は 'status' より先に着く（クライアント側）
//   どちらも「名前を出したいだけ」の listener に写しの名簿を持たせることになるので、行ごと配る。
//----------------------------------------------------------------------------------------------------

describe('lifecycle events carry the roster entry', () => {
    let hub: ReturnType<typeof ioMock>;
    beforeEach(() => { jest.useFakeTimers({ now: 0 }); Unit.reset(); hub = ioMock(); });
    afterEach(() => { Unit.engineRoot?.destroy(); jest.useRealTimers(); });

    type Event = { id: string, name: string, cpu: boolean, roster: string[] };

    // 届いた 1 通と、その瞬間の名簿。名簿の方に居るかどうかまで見るのがこのテストの主題
    function record(unit: Unit, into: Record<string, Event[]>): void {
        (['sync.connect', 'sync.disconnect'] as const).forEach((type) => {
            unit.on(type, ({ id, name, cpu }: any) => {
                into[type] = [...(into[type] ?? []), { id, name, cpu, roster: xsync.session.clients.map((client) => client.id) }];
            });
        });
    }

    it('the server sees the joiner\'s handshook name', () => {
        const seen: Record<string, Event[]> = {};
        bootServer({ io: hub.io }, function Server(unit: Unit) { record(unit, seen); });

        hub.connect('c1', ROOM.id, 'あかね');

        expect(seen['sync.connect']).toEqual([{ id: 'c1', name: 'あかね', cpu: false, roster: ['c1'] }]);
    });

    it('the server sees the leaver\'s name — the roster has already lost it', () => {
        const seen: Record<string, Event[]> = {};
        bootServer({ io: hub.io }, function Server(unit: Unit) { record(unit, seen); });

        const socket = hub.connect('c1', ROOM.id, 'あかね');
        socket.disconnect();

        // 名簿からは消えている（roster が空）のに、名前は届いている = 写しを持たずに「〇〇 が出ました」が書ける
        expect(seen['sync.disconnect']).toEqual([{ id: 'c1', name: 'あかね', cpu: false, roster: [] }]);
    });

    it('a client sees another member\'s name on the relay, before the roster catches up', () => {
        const seen: Record<string, Event[]> = {};
        bootServer({ io: hub.io }, function Server() {});
        bootClient({ socket: hub.connect('c1', ROOM.id, 'あかね') }, function Client(unit: Unit) { record(unit, seen); });

        const other = hub.connect('c2', ROOM.id, 'ずんだもん');
        other.disconnect();

        expect(seen['sync.connect']?.[0]).toMatchObject({ id: 'c2', name: 'ずんだもん', cpu: false });
        expect(seen['sync.disconnect']?.[0]).toMatchObject({ id: 'c2', name: 'ずんだもん', cpu: false });

        // relay は 'status' より先に着くので、入ってきた瞬間の名簿にはまだ c2 が居ない
        expect(seen['sync.connect']?.[0].roster).not.toContain('c2');
    });

    it('a client\'s own connect / disconnect carry the name it handshook with', () => {
        const seen: Record<string, Event[]> = {};
        bootServer({ io: hub.io }, function Server() {});
        const socket = hub.connect('c1', ROOM.id, 'あかね');
        bootClient({ socket, client: { name: 'あかね' } }, function Client(unit: Unit) { record(unit, seen); });

        // 自分のぶんは relay ではなく自分の socket イベントから届く（線が切れていても届く経路）
        socket.fire('connect');
        socket.fire('disconnect');

        expect(seen['sync.connect']?.[0]).toMatchObject({ id: 'c1', name: 'あかね', cpu: false });
        expect(seen['sync.disconnect']?.[0]).toMatchObject({ id: 'c1', name: 'あかね', cpu: false });
    });

    it('a CPU member arrives and leaves the same way, marked cpu', () => {
        const seen: Record<string, Event[]> = {};
        const room = bootServer({ io: hub.io }, function Server(unit: Unit) {
            record(unit, seen);
            return {
                add: (id: string, name: string) => xsync.cpu.join({ id, name }),
                remove: (id: string) => xsync.cpu.leave(id),
            };
        }) as Unit & { add(id: string, name: string): any, remove(id: string): boolean };

        asServer(() => room.add('cpu:1', 'CPU 1'));
        asServer(() => room.remove('cpu:1'));

        expect(seen['sync.connect']).toEqual([{ id: 'cpu:1', name: 'CPU 1', cpu: true, roster: ['cpu:1'] }]);
        expect(seen['sync.disconnect']).toEqual([{ id: 'cpu:1', name: 'CPU 1', cpu: true, roster: [] }]);
    });
});
