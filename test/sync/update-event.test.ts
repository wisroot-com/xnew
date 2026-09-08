import { Unit } from '../../src/core/unit';
import { xnew, xsync } from '../../src/index';
import { SyncNode } from '../../src/sync/boot';
import { ioMock, bootServer, bootClient, asServer } from './io-mock';

// 変更検知: server は client ごとの投影 JSON が前回と同じなら 'sync' を emit しない。
// client は 'sync' を適用（reconcile）した後に 'sync.update' を dispatch する（同一ツリーの再受信では発火しない）。

function Box(unit: Unit) {
    xsync.state({ value: 0 });
}

describe('server skips unchanged frames', () => {
    let hub: ReturnType<typeof ioMock>;
    beforeEach(() => { jest.useFakeTimers({ now: 0 }); Unit.reset(); hub = ioMock(); });
    afterEach(() => { Unit.engineRoot?.finalize(); jest.useRealTimers(); });

    it('emits sync only when the projection changed', () => {
        const server = bootServer({ io: hub.io }, function Root() { xsync.register({ Box }); xnew(Box); });
        hub.connect('c1');
        asServer(() => Unit.update(Unit.engineRoot));
        asServer(() => Unit.update(Unit.engineRoot));   // 無変化 → emit されない
        expect(hub.syncCountFor('c1')).toBe(1);
        (server._.children[0])._.sync.state.value = 9;
        asServer(() => Unit.update(Unit.engineRoot));
        expect(hub.syncCountFor('c1')).toBe(2);
    });

    it('a newly connected client receives the tree even while it is unchanged for others', () => {
        bootServer({ io: hub.io }, function Root() { xsync.register({ Box }); xnew(Box); });
        hub.connect('c1');
        asServer(() => Unit.update(Unit.engineRoot));
        hub.connect('c2');
        asServer(() => Unit.update(Unit.engineRoot));
        expect(hub.syncCountFor('c1')).toBe(1);         // c1 は無変化のままスキップ
        expect(hub.syncCountFor('c2')).toBe(1);         // c2 は初回なので届く
    });

    it('a reconnected client receives the tree again (its skip cache is cleared on disconnect)', () => {
        bootServer({ io: hub.io }, function Root() { xsync.register({ Box }); xnew(Box); });
        const socket = hub.connect('c1');
        asServer(() => Unit.update(Unit.engineRoot));
        socket.disconnect();
        hub.connect('c1');
        asServer(() => Unit.update(Unit.engineRoot));
        expect(hub.syncCountFor('c1')).toBe(2);
    });
});

describe('client dispatches sync.update', () => {
    beforeEach(() => { jest.useFakeTimers({ now: 0 }); Unit.reset(); });
    afterEach(() => { Unit.engineRoot?.finalize(); jest.useRealTimers(); });

    it('fires after reconcile with the state already applied; a redelivered tree reconciles in place', () => {
        const socket = ioMock().connect();
        const calls: number[] = [];
        const view = bootClient({ socket }, function View(unit: Unit) {
            xsync.register({ Box });
            unit.on('sync.update', () => { calls.push((view._.children[0])._.sync.state.value); });
        });
        socket.fire('sync', [{ id: 1, name: 'Box', parent: null, state: { value: 7 } }] as SyncNode[]);
        expect(calls).toEqual([7]);                     // 適用後に発火（state は反映済み）
        socket.fire('sync', [{ id: 1, name: 'Box', parent: null, state: { value: 7 } }] as SyncNode[]);
        // 変化の判定はサーバ側（クライアントへの配信自体が「変わった」の意味）。
        // 同じツリーが再送されたら、そのまま同じ replica に適用し直して発火する。
        expect(calls).toEqual([7, 7]);
        expect(view._.children.length).toBe(1);         // replica は増えない
        socket.fire('sync', [{ id: 1, name: 'Box', parent: null, state: { value: 8 } }] as SyncNode[]);
        expect(calls).toEqual([7, 7, 8]);
    });

    it('fires when a node disappears from the tree', () => {
        const socket = ioMock().connect();
        let hits = 0;
        bootClient({ socket }, function View(unit: Unit) {
            xsync.register({ Box });
            unit.on('sync.update', () => { hits++; });
        });
        socket.fire('sync', [
            { id: 1, name: 'Box', parent: null, state: {} },
            { id: 2, name: 'Box', parent: null, state: {} },
        ] as SyncNode[]);
        socket.fire('sync', [{ id: 1, name: 'Box', parent: null, state: {} }] as SyncNode[]);
        expect(hits).toBe(2);
    });

    it('reaches a replica created by the same frame (initial draw can ride the event)', () => {
        const socket = ioMock().connect();
        let hits = 0;
        function Listening(unit: Unit) {
            xsync.state({ value: 0 });
            unit.on('sync.update', () => { hits++; });
        }
        bootClient({ socket }, function View() { xsync.register({ Listening }); });
        socket.fire('sync', [{ id: 1, name: 'Listening', parent: null, state: { value: 1 } }] as SyncNode[]);
        expect(hits).toBe(1);                           // 生成フレームの dispatch が新規 replica にも届く
    });
});
