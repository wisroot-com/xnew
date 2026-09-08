import { Unit } from '../../src/core/unit';
import { xnew, xsync } from '../../src/index';
import { ioMock, bootServer, bootClient, asServer } from './io-mock';

describe('scoped registry isolation', () => {
    let hub: ReturnType<typeof ioMock>;
    beforeEach(() => { jest.useFakeTimers({ now: 0 }); Unit.reset(); hub = ioMock(); });
    afterEach(() => { Unit.engineRoot?.destroy(); jest.useRealTimers(); });

    // 同名 'Child' を 2 つの親がそれぞれ別の実体で登録する
    function ChildA(unit: Unit) { xsync.state({ kind: 'A' }); }
    function ChildB(unit: Unit) { xsync.state({ kind: 'B' }); }
    function ParentA(unit: Unit) { xsync.register({ Child: ChildA }); xnew(ChildA); }
    function ParentB(unit: Unit) { xsync.register({ Child: ChildB }); xnew(ChildB); }

    it('resolves the same name to different components per scope (capture)', () => {
        bootServer({ io: hub.io }, function Root() {
            xsync.register({ ParentA, ParentB });
            xnew(ParentA);
            xnew(ParentB);
        });
        hub.connect();   // capture は接続 client ごとの投影: 1 つつないでその投影を受ける
        asServer(() => Unit.update(Unit.engineRoot));   // root.on('update') が 'sync' を emit
        const tree = hub.lastSync();
        const childNodes = tree.filter((n: any) => n.name === 'Child');
        expect(childNodes).toHaveLength(2);
        expect(childNodes.map((n: any) => n.state.kind).sort()).toEqual(['A', 'B']);
    });

    it('apply re-creates each Child with the component its reconciled parent registered', () => {
        const server = bootServer({ io: hub.io }, function Root() {
            xsync.register({ ParentA, ParentB });
            xnew(ParentA);
            xnew(ParentB);
        });
        const client = bootClient({ socket: hub.connect() }, function ClientRoot() { xsync.register({ ParentA, ParentB }); });

        asServer(() => Unit.update(server));   // capture + 'sync' broadcast → client apply

        const replicaA = client._.children.find(c => c._.Components.includes(ParentA))!;
        const replicaB = client._.children.find(c => c._.Components.includes(ParentB))!;
        expect(replicaA._.children[0]._.Components.includes(ChildA)).toBe(true);
        expect(replicaB._.children[0]._.Components.includes(ChildB)).toBe(true);
        expect((replicaA._.children[0])._.sync.state).toEqual({ kind: 'A' });
        expect((replicaB._.children[0])._.sync.state).toEqual({ kind: 'B' });
    });

    it('a child not registered by its parent is omitted from capture', () => {
        function Loose(unit: Unit) { xsync.state({ v: 1 }); }
        bootServer({ io: hub.io }, function Root() { xnew(Loose); });   // Root は Loose を register しない
        hub.connect();
        asServer(() => Unit.update(Unit.engineRoot));
        expect(hub.lastSync()).toHaveLength(0);
    });

    it('throws when register is called outside a component body', () => {
        const err = jest.spyOn(console, 'error').mockImplementation(() => {});
        function Solo(unit: Unit) {}
        // トップレベル（構築中のユニットが無い）で呼ぶとエラー
        expect(() => xsync.register({ Solo })).toThrow('during component initialization');
        err.mockRestore();
    });
});
