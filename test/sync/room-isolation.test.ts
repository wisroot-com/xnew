import { Unit } from '../../src/core/unit';
import { xnew, xsync } from '../../src/index';
import { ioMock, bootServer, asServer } from './io-mock';

//----------------------------------------------------------------------------------------------------
// 部屋の境界 — boot したルートは protect 境界になる。
//   1 つの Node プロセスが部屋をいくつも抱え、どの部屋も同じ Component 関数を共有するので、
//   境界が無いと xnew.find（キー無し）や '+event' が隣の部屋の unit まで掴んでしまう。
//   イベント（RoomIO.dispatch）は sync.root で既に部屋ごとだが、find と '+event' は
//   グローバルな登録簿を引くため、ここで塞ぐ。
//----------------------------------------------------------------------------------------------------

describe('room isolation (a booted root is a protect boundary)', () => {
    let hub: ReturnType<typeof ioMock>;
    let pings: string[];

    beforeEach(() => { jest.useFakeTimers({ now: 0 }); Unit.reset(); hub = ioMock(); pings = []; });
    afterEach(() => { Unit.engineRoot?.destroy(); jest.useRealTimers(); });

    function Player(unit: Unit) {}

    // 部屋 1 つぶん。find / emit は defines 経由で「部屋の内側のスコープ」から呼ぶ
    function Room(unit: Unit, { tag = '' }: { tag?: string } = {}) {
        asServer(() => {
            xnew(Player, { key: `${tag}:1` });
            xnew(Player, { key: 'bot' });          // 部屋ごとに発番する id は衝突しうる
            unit.on('+ping', () => pings.push(tag));
        });
        return {
            players: () => xnew.find(Player).length,
            byKey: (key: string) => xnew.find(Player, { key }).length,
            ping: () => xnew.emit('+ping'),
        };
    }

    type RoomUnit = Unit & { players(): number, byKey(key: string): number, ping(): void };

    const boot = (tag: string): RoomUnit =>
        bootServer({ io: hub.io, room: { id: tag, name: tag, count: 0 } }, Room, { tag }) as RoomUnit;

    it('a keyless find inside one room does not reach another room', () => {
        const a = boot('A');
        const b = boot('B');

        expect(asServer(() => a.players())).toBe(2);
        expect(asServer(() => b.players())).toBe(2);
    });

    it('the same key in two rooms resolves to the own room only', () => {
        const a = boot('A');
        const b = boot('B');

        expect(asServer(() => a.byKey('bot'))).toBe(1);
        expect(asServer(() => b.byKey('bot'))).toBe(1);
        expect(asServer(() => a.byKey('B:1'))).toBe(0);
    });

    it("a '+event' stays inside the room it was emitted in", () => {
        boot('A');
        const b = boot('B');

        asServer(() => b.ping());

        expect(pings).toEqual(['B']);
    });
});
