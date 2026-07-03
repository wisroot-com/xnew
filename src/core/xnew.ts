//----------------------------------------------------------------------------------------------------
// xnew — public entry point of the library
//
// xnew(...) は現在アクティブな Unit の子として新しい Unit を生成する（初回呼び出しで root と
// ticker を自動初期化）。各ヘルパーは暗黙の Unit.currentUnit に作用するため、Component 関数の
// 中から呼ぶ。実装は Unit の static メソッドへの薄い転送のみ。
//
// - xnew.nest / extend                   : 初期化中の Unit を拡張
// - xnew.find / context                  : Component による検索 / 祖先コンテキスト解決
// - xnew.promise                         : Unit に promise を登録（集約リザルトは xnew.promise(unit) で取得し .then/.catch/.finally）
// - xnew.scope / emit / protect          : スコープ捕捉 / '+global' '-local' イベント / 可視性境界
// - xnew.timeout / interval / transition : UnitTimer によるスケジューリング
// - xnew.{Unit,Component}                : 公開型（呼び出し可能な値に型名前空間をマージ）
//----------------------------------------------------------------------------------------------------
//
// 実行環境限定の extend（旧 xnew.server / xnew.client）は sync 配下へ移動した（src/sync/engine.ts）。

import { Unit, UnitPromise, UnitTimer, ComponentFn, DefinesOf, PropsOf } from './unit';
import { DomElement } from './dom';

// xnew(...) の呼び出しシグネチャ。Component を渡した形は戻り値に defines を合成する(Unit & DefinesOf<C>)。
export interface XnewBase {
    <C extends ComponentFn<any, any>>(Component: C, props?: PropsOf<C>): Unit & DefinesOf<C>;
    <C extends ComponentFn<any, any>>(target: DomElement | string, Component: C, props?: PropsOf<C>): Unit & DefinesOf<C>;
    (target: DomElement | string, content?: string | number): Unit;
    (content: string | number): Unit;
    (parent: Unit | null, ...args: any[]): Unit;
    (): Unit;
}

export const xnew = Object.assign(
    /** Creates a new Unit: xnew((target,) Component?, props?) — target は要素か '<div>' 等のタグ文字列。 */
    (function(...args: any[]): Unit {
        if (Unit.engineRoot === undefined) Unit.reset();

        if (args[0] instanceof Unit) {
            const parent = args.shift() as Unit;
            const snapshot = parent._.lastSnapshot ?? Unit.snapshot(parent);
            return Unit.scope(snapshot, () => Unit.create(parent, ...args)) as Unit;
        } else {
            const parent = Unit.currentUnit ?? null;
            return Unit.create(parent, ...args);
        }
    }) as unknown as XnewBase,
    {
        /** Nests a child element（既存要素 or '<div>' 等のタグ文字列）。初期化中のみ呼べる。 */
        nest(target: DomElement | string): HTMLElement | SVGElement {
            if (Unit.currentUnit._.status !== 'invoked') {
                throw new Error('xnew.nest can not be called after initialized.');
            }
            return Unit.nest(Unit.currentUnit, target);
        },

        /** Extends the current unit with another component. 初期化中のみ呼べる。defines を返す。 */
        extend<C extends ComponentFn<any, any>>(Component: C, props?: PropsOf<C>): DefinesOf<C> {
            if (Unit.currentUnit._.status !== 'invoked') {
                throw new Error('xnew.extend can not be called after initialized.');
            }
            if (Unit.currentUnit._.Components.includes(Component) === true) {
                console.warn('Component is already extended in this unit:', Component);
            }
            return Unit.extend(Unit.currentUnit, Component, props) as DefinesOf<C>;
        },

        /** Returns the nearest unit associated with the given component in the ancestor context chain. */
        context(key: any): any {
            return Unit.getContext(Unit.currentUnit, key);
        },
            
        /** Registers a promise to the current unit。第1引数が string ならキー。executor 関数 / 素の Promise / Unit のいずれかを受け取る（executor は new Promise 同様 (resolve, reject) を受け取る）。Unit を渡すとそのキー付き結果を集約する（対象 unit のプールは消費しない）。 */
        promise: (function (keyOrPromise?: any, maybePromise?: any): UnitPromise {
            const key = typeof keyOrPromise === 'string' ? keyOrPromise : undefined;
            const promise = typeof keyOrPromise === 'string' ? maybePromise : keyOrPromise;
            // 旧仕様 `name[index]`（数値添字）は廃止。登録順に push する `name[]` に誘導する。
            if (key !== undefined && /^.+\[\d+\]$/.test(key)) {
                throw new Error(`xnew.promise: indexed key "${key}" is no longer supported; use "${key.replace(/\[\d+\]$/, '[]')}" to append in registration order`);
            }
            // 集約（Unit）/ 素の Promise / コールバック(executor)のいずれでも最終的に一つの UnitPromise に包む。
            // Unit を渡した場合は対象のプールを集約する。プールは消費しない（同じ unit を何度集約しても
            // 同じ promise 群を見る）。results は登録時点の配列をクロージャで握るので、集約後に対象 unit へ
            // promise を追加しても進行中の集約は無傷。
            let source: any;
            if (promise instanceof Unit) {
                source = UnitPromise.collect(promise._.promises);
            } else if (promise instanceof Promise) {
                source = promise;
            } else {
                source = new Promise(xnew.scope(promise));
            }
            const unitPromise = new UnitPromise(source, key);
            Unit.currentUnit._.promises.push(unitPromise);
            return unitPromise;
        }) as {
            (promise: Function | Promise<any> | Unit): UnitPromise;
            (key: string, promise: Function | Promise<any> | Unit): UnitPromise;
        },

        /** Wraps a callback so it later runs in the current unit scope（setTimeout 等の外部コールバック用）。 */
        scope(callback: any): any {
            const snapshot = Unit.snapshot(Unit.currentUnit);
            return (...args: any[]) => Unit.scope(snapshot, callback, ...args);
        },

        /** Finds units by component. opts.key で予約 prop `key` の一致に絞る（key はグローバル一意の想定）。 */
        find(Component: Function, opts?: { key?: any }): Unit[] {
            return Unit.find(Component, opts?.key);
        },

        /** Emits a custom event（'+event' = 全体へ / '-event' = 自 unit のみ）。 */
        emit(type: string, ...args: any[]): void {
            return Unit.emit(Unit.currentUnit, type, ...args);
        },

        /** Runs callback({ timer }) once after duration ms（timer は UnitTimer インスタンス。unit のライフサイクルに従う。clear() で中止）。 */
        timeout(callback: Function, duration: number = 0): UnitTimer {
            return new UnitTimer().timeout(callback, duration);
        },

        /** Runs callback({ timer }) every duration ms（timer は UnitTimer インスタンス（timer.clear() で停止）。iterations 回。0 は無限）。 */
        interval(callback: Function, duration: number, iterations: number = 0): UnitTimer {
            return new UnitTimer().interval(callback, duration, iterations);
        },

        /** Runs transition({ value: 0→1, timer }) over duration ms（timer は UnitTimer インスタンス。easing: 'linear'|'ease'|'ease-in'|'ease-out'|'ease-in-out'。チェーン可）。 */
        transition(transition: Function, duration: number = 0, easing: string = 'linear'): UnitTimer {
            return new UnitTimer().transition(transition, duration, easing);
        },

        /**
         * Marks the current unit as a protection boundary: 子孫はサブツリー外からの '+event' emit /
         * find に映らなくなる（unit 自身は可視のまま。サブツリー内からの emit / find は通常どおり）。
         */
        protect(): void {
            Unit.currentUnit._.protected = true;
        },

    }
);

// 呼び出し可能な値 xnew に型名前空間をマージする（xnew.Unit などの公開型）。
export namespace xnew {
    export type Unit = InstanceType<typeof Unit>;
    export type Component<P extends object = any, A extends object = {}> = ComponentFn<P, A>;
}

