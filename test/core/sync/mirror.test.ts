import { Unit } from '../../../src/core/unit';
import { syncOf } from '../../../src/sync/xsync';
import { xnew, xsync } from '../../../src/index';
import { ioMock, bootServer, bootClient, asServer, asClient } from './io-mock';

// 1 関数コンポーネント: server ブロック(ロジック)と client ブロック(描画) を持つ。どちらも update。
function Mover(unit: Unit) {
    const state = xsync.state({ position: 0 });
    xsync.server(() => {
        unit.on('update', () => { state.position += 1; });   // server のみ
    });
    xsync.client(() => {
        const el = xnew.nest('<div>');
        unit.on('update', () => { (el as HTMLElement).style.left = `${state.position}px`; }); // client のみ
    });
}

// capture / apply は boot 内部に移動した。server boot は root.on('update') で 'sync' を broadcast し、
// client boot は on('sync') で apply する。よって「server を update する」だけで client へ反映される
// （明示の applyStateTree(client, captureStateTree(server)) 呼び出しは不要）。
describe('server/client mirror (server/client blocks)', () => {
    let hub: ReturnType<typeof ioMock>;
    beforeEach(() => { jest.useFakeTimers({ now: 0 }); Unit.reset(); hub = ioMock(); });
    afterEach(() => { Unit.engineRoot?.finalize(); jest.useRealTimers(); });

    it('mirrors server state into the client subtree and renders it', () => {
        const server = bootServer({ io: hub.io }, function Server() { xsync.register({ Mover }); xnew(Mover); });
        const client = bootClient({ socket: hub.connect() }, function ClientRoot() { xsync.register({ Mover }); });

        function cycle() {
            asServer(() => Unit.update(server));   // server Mover: position += 1 → 'sync' broadcast → client apply
            asClient(() => Unit.update(client));   // replica update（描画）
        }

        cycle();
        const replicaMover = client._.children[0];
        expect(syncOf(replicaMover).state!.position).toBe(1);
        expect((replicaMover.element as HTMLElement).style.left).toBe('1px');   // client block render consumed synced state

        cycle();
        expect(syncOf(replicaMover).state!.position).toBe(2);
        expect((replicaMover.element as HTMLElement).style.left).toBe('2px');
        expect(client._.children.length).toBe(1);
    });

    it('routes a single shared Main root to server/client by mode and mounts replicas into the nested element', () => {
        const view = document.createElement('div');   // 既存の描画先（例の #view 相当）

        // server/client 共通の非同期ルート。中で xsync.server / xsync.client に分岐する。
        function Main() {
            xsync.register({ Mover });               // server/client 共通: Mover を直接の同期子として宣言
            xsync.server(() => { xnew(Mover); });        // server: ロジックツリー
            xsync.client(() => { xnew.nest(view); });    // client: 既存要素を描画先にする
        }

        const server = bootServer({ io: hub.io }, Main);
        const client = bootClient({ socket: hub.connect() }, Main);

        asServer(() => Unit.update(server));   // capture + 'sync' → client apply（同時にトポロジを確認）

        // 非同期の Main を挟んでもトポロジは不変: Mover の parent は null のまま。
        const tree = hub.lastSync();
        expect(tree.length).toBe(1);
        expect(tree[0].name).toBe('Mover');
        expect(tree[0].parent).toBeNull();
        expect(server._.children[0]._.Components).toContain(Mover);   // Main の server ブロックが生成した Mover

        asClient(() => Unit.update(client));

        // client Main の下に replica Mover が生成され、nest した既存 view 要素の配下に mount される。
        const replicaMover = client._.children[0];
        expect(replicaMover).toBeDefined();
        expect(syncOf(replicaMover).state!.position).toBe(1);
        expect(view.contains(replicaMover.element as Node)).toBe(true);
        expect((replicaMover.element as HTMLElement).style.left).toBe('1px');
    });

    it('mirrors spawn and despawn driven from server update', () => {
        function Server(unit: Unit) {
            xsync.register({ Mover });
            let spawned = false; let child: Unit | null = null;
            xsync.server(() => {
                unit.on('update', () => {
                    if (!spawned) { child = xnew(Mover) as unknown as Unit; spawned = true; }
                    else if (child) { child.finalize(); child = null; }
                });
            });
        }
        const server = bootServer({ io: hub.io }, Server);
        const client = bootClient({ socket: hub.connect() }, function ClientRoot() { xsync.register({ Mover }); });

        asServer(() => Unit.update(server)); // server update が Mover を spawn → 'sync' → client apply
        expect(client._.children.length).toBe(1);    // spawn mirrored
        asServer(() => Unit.update(server)); // server update が Mover を despawn → 'sync' → client remove
        expect(client._.children.length).toBe(0);     // despawn mirrored
    });
});
