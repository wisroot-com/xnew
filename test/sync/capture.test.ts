import { Unit } from '../../src/core/unit';
import { syncData } from '../../src/sync/xsync';
import { xnew, xsync } from '../../src/index';
import { ioMock, bootServer, asServer } from './io-mock';

// capture は boot 内部へ移動したため、検証は boot 経由で行う:
// server boot は root.on('update') で captureStateTree() を 'sync' として emit し、io-mock が
// それを記録する。よって boot → start → update のあと hub.lastSync() で emit されたツリーを得る。

function Player() {}

describe('registry (scoped)', () => {
    let hub: ReturnType<typeof ioMock>;
    beforeEach(() => { jest.useFakeTimers({ now: 0 }); Unit.reset(); hub = ioMock(); });
    afterEach(() => { Unit.engineRoot?.finalize(); jest.useRealTimers(); });

    // component を server boot し、1 接続をつないで 1 度 update し、その client に emit された 'sync' ツリーを返す。
    // capture は接続 client ごとの投影になったため、記録を得るには client を 1 つつなぐ必要がある。
    function capture(Component: any): any[] {
        bootServer({ io: hub.io }, Component);
        hub.connect();
        asServer(() => Unit.update(Unit.engineRoot));
        return hub.lastSync() ?? [];
    }

    it('a child is synced under the name its parent registered', () => {
        const tree = capture(function Root() { xsync.register({ Player }); xnew(Player); });
        expect(tree.map((n: any) => n.name)).toContain('Player');
    });

    it('a child whose parent did not register it is not synced', () => {
        const tree = capture(function Root() { xnew(Player); });   // register していない
        expect(tree).toHaveLength(0);
    });

    it('a unit whose parent has no registry is not synced', () => {
        const tree = capture((u: Unit) => {});
        expect(tree).toHaveLength(0);
    });
});

describe('captureStateTree', () => {
    let hub: ReturnType<typeof ioMock>;
    beforeEach(() => { jest.useFakeTimers({ now: 0 }); Unit.reset(); hub = ioMock(); });
    afterEach(() => { Unit.engineRoot?.finalize(); jest.useRealTimers(); });

    function World(unit: Unit) { xsync.register({ Child }); xsync.state({ tick: 0 }); xnew(Child); }
    function Child(unit: Unit) { xsync.state({ position: 5 }); }

    function capture(Component: any): any[] {
        bootServer({ io: hub.io }, Component);
        hub.connect();
        asServer(() => Unit.update(Unit.engineRoot));
        return hub.lastSync() ?? [];
    }

    it('captures a synced unit; parent is null when no synced ancestor exists', () => {
        const tree = capture(function Root() { xsync.register({ World }); xnew(World); });
        const worldNode = tree.find((n: any) => n.name === 'World')!;
        expect(worldNode).toBeDefined();
        expect(worldNode.parent).toBeNull();
        expect(worldNode.state).toEqual({ tick: 0 });
    });

    it('sets a child parent to the nearest synced ancestor id', () => {
        const tree = capture(function Root() { xsync.register({ World }); xnew(World); });
        const worldNode = tree.find((n: any) => n.name === 'World')!;
        const childNode = tree.find((n: any) => n.name === 'Child')!;
        expect(childNode.parent).toBe(worldNode.id);
    });

    it('assigns stable ids and reflects mutated state on later captures', () => {
        const server = bootServer({ io: hub.io }, function Root() { xsync.register({ Child }); xnew(Child); });
        hub.connect();
        asServer(() => Unit.update(Unit.engineRoot));
        const first = hub.lastSync()[0];
        syncData(server._.children[0]).state!.position = 9;
        asServer(() => Unit.update(Unit.engineRoot));
        const second = hub.lastSync()[0];
        expect(second.id).toBe(first.id);
        expect(second.state).toEqual({ position: 9 });
    });
});
