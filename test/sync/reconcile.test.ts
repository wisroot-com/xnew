import { Unit } from '../../src/core/unit';
import { xnew, xsync } from '../../src/index';
import { ioMock, bootClient } from './io-mock';
import { syncOf, SyncNode } from '../../src/sync/xsync';

// apply は boot 内部へ移動したため、client boot の socket に 'sync' を fire して駆動する。
// socket.fire は受信を client 環境で擬似発火し、boot の on('sync')→apply を呼ぶ（手で作ったツリーを流し込める）。

function Box(unit: Unit) {
    xsync.register({ Box });   // Box は自分を直接の同期子として許可（ネスト用）
    const state = xsync.state({ value: 0 });
    xsync.client(() => {
        const el = xnew.nest('<div>');
        unit.on('update', () => { (el as HTMLElement).textContent = String(state.value); });
    });
}

describe('applyStateTree create', () => {
    beforeEach(() => { jest.useFakeTimers({ now: 0 }); Unit.reset(); });
    afterEach(() => { Unit.engineRoot?.finalize(); jest.useRealTimers(); });

    function makeView() {
        const socket = ioMock().connect();
        const view = bootClient({ socket }, function View() { xsync.register({ Box }); });
        return { view, socket };
    }

    it('creates client units under the reconcile root with state applied', () => {
        const { view, socket } = makeView();
        const tree: SyncNode[] = [{ id: 1, name: 'Box', parent: null, state: { value: 7 } }];
        socket.fire('sync', tree);
        expect(view._.children.length).toBe(1);
        const child = view._.children[0];
        expect(syncOf(child).id).toBe(1);
        expect(syncOf(child).state).toEqual({ value: 7 });
    });

    it('creates nested replica units honoring parent', () => {
        const { view, socket } = makeView();
        socket.fire('sync', [
            { id: 1, name: 'Box', parent: null, state: { value: 1 } },
            { id: 2, name: 'Box', parent: 1, state: { value: 2 } },
        ]);
        expect(syncOf(view._.children[0]).id).toBe(1);
        expect(syncOf(view._.children[0]._.children[0]).id).toBe(2);
    });
});

describe('applyStateTree state injection (client inits from server state)', () => {
    let observed: Record<string, any> | null;
    function Probe(unit: Unit) {
        const state = xsync.state({ value: 0, who: 'local' });
        observed = { ...state };   // 本体実行時点で見えている state のスナップショット
    }
    beforeEach(() => { jest.useFakeTimers({ now: 0 }); Unit.reset(); observed = null; });
    afterEach(() => { Unit.engineRoot?.finalize(); jest.useRealTimers(); });
    function makeView() {
        const socket = ioMock().connect();
        const view = bootClient({ socket }, function View() { xsync.register({ Probe }); });
        return { view, socket };
    }

    it('injects server state before the body runs so local initial is ignored', () => {
        const { socket } = makeView();
        socket.fire('sync', [{ id: 1, name: 'Probe', parent: null, state: { value: 42, who: 'server' } }]);
        expect(observed).toEqual({ value: 42, who: 'server' });   // 本体実行時には既に注入済み
    });

    it('does not leak injected state to a unit created outside apply (read-once)', () => {
        const { socket } = makeView();
        socket.fire('sync', [{ id: 1, name: 'Probe', parent: null, state: { value: 42, who: 'server' } }]);
        observed = null;
        xnew(function Holder() { xsync.register({ Probe }); xnew(Probe); });   // apply 経由でない生成（null mode）
        expect(observed).toEqual({ value: 0, who: 'local' });
    });
});

describe('applyStateTree update', () => {
    beforeEach(() => { jest.useFakeTimers({ now: 0 }); Unit.reset(); });
    afterEach(() => { Unit.engineRoot?.finalize(); jest.useRealTimers(); });
    function makeView() {
        const socket = ioMock().connect();
        const view = bootClient({ socket }, function View() { xsync.register({ Box }); });
        return { view, socket };
    }

    it('updates existing unit in place without recreating it', () => {
        const { view, socket } = makeView();
        socket.fire('sync', [{ id: 1, name: 'Box', parent: null, state: { value: 1 } }]);
        const first = view._.children[0];
        socket.fire('sync', [{ id: 1, name: 'Box', parent: null, state: { value: 2 } }]);
        expect(view._.children[0]).toBe(first);
        expect(syncOf(first).state).toEqual({ value: 2 });
        expect(view._.children.length).toBe(1);
    });
});

describe('applyStateTree remove', () => {
    beforeEach(() => { jest.useFakeTimers({ now: 0 }); Unit.reset(); });
    afterEach(() => { Unit.engineRoot?.finalize(); jest.useRealTimers(); });
    function makeView() {
        const socket = ioMock().connect();
        const view = bootClient({ socket }, function View() { xsync.register({ Box }); });
        return { view, socket };
    }

    it('finalizes replica units whose id disappears from the tree', () => {
        const { view, socket } = makeView();
        socket.fire('sync', [
            { id: 1, name: 'Box', parent: null, state: {} },
            { id: 2, name: 'Box', parent: null, state: {} },
        ]);
        expect(view._.children.length).toBe(2);
        const removed = view._.children.find(c => syncOf(c).id === 2)!;
        socket.fire('sync', [{ id: 1, name: 'Box', parent: null, state: {} }]);
        expect(view._.children.length).toBe(1);
        expect(syncOf(view._.children[0]).id).toBe(1);
        expect(removed._.status).toBe('finalized');
    });
});
