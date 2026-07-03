import { Unit } from '../../../src/core/unit';
import { syncOf } from '../../../src/sync/xsync';
import { xnew, xsync } from '../../../src/index';
import { ioMock, bootServer, bootClient, asServer, asServerAsync, asClient } from './io-mock';

// 2 階層: Mover が server ブロック内で定期的に Enemy(synced 子) を spawn し、
// 各 Enemy は所定方向へ移動して一定時間で消える。ブラウザ例 (index.js) と同じ構造の検証。
// capture / apply は boot 内部に移動した: server を update すると root.on('update') が 'sync' を
// broadcast し、client boot が apply する（明示の applyStateTree(client, captureStateTree(server)) は不要）。

function Enemy(unit: Unit, props: any = {}) {
    const state = xsync.state({ x: props.x ?? 0 });
    xsync.server(() => {
        unit.on('update', () => { state.x += 1; });          // 所定方向へ移動
        xnew.timeout(() => unit.finalize(), 1000);           // 一定時間で消滅
    });
    xsync.client(() => {
        const el = xnew.nest('<div>');
        unit.on('update', () => { (el as HTMLElement).style.left = `${state.x}px`; });
    });
}

function Mover(unit: Unit) {
    xsync.register({ Enemy });
    const state = xsync.state({ spawned: 0 });
    xsync.server(() => {
        xnew.interval(() => { state.spawned += 1; xnew(Enemy, { x: 0 }); }, 500); // 定期 spawn
    });
    xsync.client(() => {
        xnew.nest('<div>');                                   // Enemy を内包するコンテナ
    });
}

describe('2-level spawn hierarchy (Mover -> Enemy)', () => {
    let hub: ReturnType<typeof ioMock>;
    beforeEach(() => {
        jest.useFakeTimers({ now: 0 });
        Unit.reset();
        hub = ioMock();
    });
    afterEach(() => { Unit.engineRoot?.finalize(); jest.useRealTimers(); });

    it('captures Enemy as a child of Mover and mirrors the 2-level tree on the replica', async () => {
        const server = bootServer({ io: hub.io }, function Root() { xsync.register({ Mover }); xnew(Mover); });
        const client = bootClient({ socket: hub.connect() }, function ClientRoot() { xsync.register({ Mover }); });

        await asServerAsync(() => jest.advanceTimersByTimeAsync(500));   // interval 発火 → Enemy spawn（server 構築）
        asServer(() => Unit.update(server));                   // server Enemy が移動 + 'sync' broadcast → client apply

        const tree = hub.lastSync();
        const moverNode = tree.find((n: any) => n.name === 'Mover')!;
        const enemyNode = tree.find((n: any) => n.name === 'Enemy')!;
        expect(moverNode.parent).toBeNull();
        expect(enemyNode).toBeDefined();
        expect(enemyNode.parent).toBe(moverNode.id);       // 2 階層: Enemy の親は Mover

        asClient(() => Unit.update(client));

        const replicaMover = client._.children[0];
        expect(syncOf(replicaMover).id).toBe(moverNode.id);
        const replicaEnemy = replicaMover._.children.find(c => syncOf(c).id === enemyNode.id)!;
        expect(replicaEnemy).toBeDefined();                  // replica 側も Mover -> Enemy の 2 階層
        expect(syncOf(replicaEnemy).state!.x).toBe(enemyNode.state.x);
    });

    it('despawns Enemy after its lifetime and removes that replica', async () => {
        const server = bootServer({ io: hub.io }, function Root() { xsync.register({ Mover }); xnew(Mover); });
        const client = bootClient({ socket: hub.connect() }, function ClientRoot() { xsync.register({ Mover }); });

        await asServerAsync(() => jest.advanceTimersByTimeAsync(500));   // 最初の Enemy が spawn
        asServer(() => Unit.update(server));                   // capture + 'sync' → client apply
        const replicaMover = client._.children[0];
        expect(replicaMover._.children.length).toBe(1);
        const firstEnemy = replicaMover._.children[0];
        const firstId = syncOf(firstEnemy).id;

        await asServerAsync(() => jest.advanceTimersByTimeAsync(1000));   // 最初の Enemy の寿命経過 → server 側 finalize
        asServer(() => Unit.update(server));                   // capture + 'sync' → client apply
        // 最初の Enemy は replica からも消える（interval で別の Enemy は spawn され続ける）
        expect(firstEnemy._.status).toBe('finalized');
        expect(replicaMover._.children.some(c => syncOf(c).id === firstId)).toBe(false);
    });
});
