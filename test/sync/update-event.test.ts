import { Unit } from '../../src/core/unit';
import { xnew, xsync } from '../../src/index';
import { SyncNode, syncData } from '../../src/sync/xsync';
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
        syncData(server._.children[0]).state.value = 9;
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

    it('fires after reconcile with the state already applied; an identical tree does not fire', () => {
        const socket = ioMock().connect();
        const calls: number[] = [];
        const view = bootClient({ socket }, function View(unit: Unit) {
            xsync.register({ Box });
            unit.on('sync.update', () => { calls.push(syncData(view._.children[0]).state.value); });
        });
        socket.fire('sync', [{ id: 1, name: 'Box', parent: null, state: { value: 7 } }] as SyncNode[]);
        expect(calls).toEqual([7]);                     // 適用後に発火（state は反映済み）
        socket.fire('sync', [{ id: 1, name: 'Box', parent: null, state: { value: 7 } }] as SyncNode[]);
        expect(calls).toEqual([7]);                     // 同一ツリー → 発火しない
        socket.fire('sync', [{ id: 1, name: 'Box', parent: null, state: { value: 8 } }] as SyncNode[]);
        expect(calls).toEqual([7, 8]);
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
