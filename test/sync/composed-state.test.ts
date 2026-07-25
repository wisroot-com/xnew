import { Unit } from '../../src/core/unit';
import { xnew, xsync } from '../../src/index';
import { ioMock, bootServer, bootClient, asServer, asClient } from './io-mock';

// capture / apply は boot 内部に移動した。server boot は root.on('update') で 'sync' を broadcast し、
// client boot は on('sync') で apply するので、「server を update する」だけで client へ反映される。

// Base: synced state を宣言する基底コンポーネント（最初の sync.state 宣言）
function Base(unit: Unit) {
    const state = xsync.state({ hp: 100 });
    xsync.server(() => { unit.on('update', () => { state.hp += 1; }); });
}

// Enemy: Base を extend した上で自分の synced state も宣言する（2番目の sync.state 宣言）
let clientReadAtConstruction: Record<string, any> = {};
function Enemy(unit: Unit) {
    xnew.extend(Base);
    const state = xsync.state({ x: 0 });
    xsync.server(() => { unit.on('update', () => { state.x += 3; }); });
    xsync.client(() => {
        // 構築時点での state を記録（注入が全宣言に効いていれば全てサーバー値になる）
        clientReadAtConstruction = { ...state };
    });
}

describe('composed synced state (base + extend)', () => {
    let hub: ReturnType<typeof ioMock>;
    beforeEach(() => {
        jest.useFakeTimers({ now: 0 });
        Unit.reset();
        hub = ioMock();
        clientReadAtConstruction = {};
    });
    afterEach(() => { Unit.engineRoot?.finalize(); jest.useRealTimers(); });

    it('hydrates every sync.state declaration from injected server state at construction time', () => {
        const server = bootServer({ io: hub.io }, function Server() { xsync.register({ Enemy }); xnew(Enemy); });
        const client = bootClient({ socket: hub.connect() }, function ClientRoot() { xsync.register({ Enemy }); });

        asServer(() => Unit.update(server));   // server Enemy: hp=101, x=3 → 'sync' → client が replica を生成

        const replica = client._.children[0];
        // Base(hp) と Enemy(x) の両宣言が、構築時点でサーバー値として読めている
        expect(clientReadAtConstruction).toEqual({ hp: 101, x: 3 });
        expect(Unit.syncData(replica).state).toEqual({ hp: 101, x: 3 });
    });

    it('keeps the first value when keys collide across declarations (existing-wins)', () => {
        const unit = xnew((u: Unit) => {
            xsync.state({ pos: 1 });
            xsync.state({ pos: 2 });   // 同名キー: 既存（先勝ち）を尊重
        });
        expect(Unit.syncData(unit).state).toEqual({ pos: 1 });   // existing-wins（プリシード/先行宣言を優先する規則と一貫）
    });

    it('does not leak injected state into a non-synced child built during the body', () => {
        let childState: Record<string, any> = {};
        function Host(unit: Unit) {
            xsync.state({ value: 0 });
            xsync.server(() => { unit.on('update', () => { (Unit.syncData(unit).state as any).value += 5; }); });
            // 本体内でインライン生成する非 synced 子（apply ではなく親本体が生成する）
            xsync.client(() => {
                xnew(function Child() { childState = xsync.state({ value: -1 }); });
            });
        }
        const server = bootServer({ io: hub.io }, function Server() { xsync.register({ Host }); xnew(Host); });
        const client = bootClient({ socket: hub.connect() }, function ClientRoot() { xsync.register({ Host }); });

        asServer(() => Unit.update(server));   // server Host: value=5 → 'sync' → client が replica Host + inline Child を生成

        const replicaHost = client._.children[0];
        expect(Unit.syncData(replicaHost).state!.value).toBe(5);             // Host は注入値
        expect(childState.value).toBe(-1);                      // 子は自分の initial（親の注入が漏れない）
    });

    // 基底コンポーネントも register されている場合（単独利用もあり得るため）でも、
    // 実際にインスタンス化した最も派生したコンポーネントの名前で同期される。
    it('syncs under the most-derived registered name even when the base is also registered', () => {
        function ActorBase(unit: Unit, props: any = {}) { xsync.state({ x: 0, y: props.y ?? 0 }); }
        function EnemyDerived(unit: Unit, props: any = {}) { xnew.extend(ActorBase, props); xsync.state({ hp: 3 }); }
        const server = bootServer({ io: hub.io }, function S() { xsync.register({ ActorBase, EnemyDerived }); xnew(EnemyDerived, { y: 8 }); });
        hub.connect();   // capture は接続 client ごとの投影: 1 つつないでその投影を受ける

        asServer(() => Unit.update(server));
        const tree = hub.lastSync();
        expect(tree).toHaveLength(1);
        expect(tree[0].name).toBe('EnemyDerived');   // 基底 ActorBase ではなく派生 EnemyDerived
        expect(tree[0].state).toEqual({ x: 0, y: 8, hp: 3 });
    });

    // base + extend の合成構成: 基底 Actor(位置+描画) を Enemy が extend し hp を足す。
    it('mirrors the example: extended base nests the element, both declarations sync and render', () => {
        // 基底: 位置 {x,y} を宣言し、client で要素を nest して位置を反映する
        function Actor(unit: Unit, props: any = {}) {
            const pos = xsync.state({ x: 0, y: props.y ?? 0 });
            xsync.client(() => {
                const el = xnew.nest('<div>') as HTMLElement;
                unit.on('update', () => { el.style.left = `${pos.x}px`; el.style.top = `${pos.y}px`; });
            });
        }
        // 拡張: Actor を取り込み hp を足し、基底が nest した要素を unit.element 経由で着色する
        function Sprite(unit: Unit, props: any = {}) {
            xnew.extend(Actor, props);
            const state = xsync.state({ hp: 3 });
            xsync.server(() => { unit.on('update', () => { state.x += 3; state.hp -= 1; }); });
            xsync.client(() => {
                const el = unit.element as HTMLElement;
                unit.on('update', () => { el.style.background = state.hp >= 2 ? 'red' : 'gray'; });
            });
        }
        const server = bootServer({ io: hub.io }, function Server() { xsync.register({ Sprite }); xnew(Sprite, { y: 8 }); });
        const client = bootClient({ socket: hub.connect() }, function ClientRoot() { xsync.register({ Sprite }); });

        asServer(() => Unit.update(server));   // server Sprite: x=3, hp=2 → 'sync' → client が replica を生成

        const tree = hub.lastSync();
        expect(tree).toHaveLength(1);
        expect(tree[0].state).toEqual({ x: 3, y: 8, hp: 2 });    // Actor 由来(x,y) + Sprite 由来(hp) がマージ

        asClient(() => Unit.update(client));                      // replica update（両描画ハンドラが走る）

        const el = client._.children[0].element as HTMLElement;
        expect(el.style.left).toBe('3px');                      // 基底 Actor の render（位置）
        expect(el.style.top).toBe('8px');
        expect(el.style.background).toBe('red');                // 拡張 Sprite の render（hp 由来の色）
    });
});
