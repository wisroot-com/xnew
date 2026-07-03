//----------------------------------------------------------------------------------------------------
// xpixi — PixiJS 8 integration
//
// `initialize({ canvas })` mounts a Root Unit that auto-detects a Pixi renderer and owns a root
// Container. Two ways to attach a display object to the current Pixi parent (root scene or nearest
// enclosing nest):
//   - `nest(displayObject)` : attach AND make this object the current parent — subsequent nests in
//                             descendant units (and later nests in the same unit) go *inside* it.
//   - `add(displayObject)`  : attach only; does NOT change the current parent (use to place siblings).
// Both tie the object's removal to Unit finalize, so the xnew tree and Pixi scene graph stay in
// sync automatically. `remove(displayObject)` does that same detach + destroy on demand.
// `xpixi.load(source)` loads textures via PIXI.Assets and registers the load on the current Unit
// (symmetric to the `xbasics.AudioTrack` component's load), so the Unit's promise aggregation
// waits for it.
//
// Caveat: `nest` is stateful — two `nest` calls in the same unit produce two nesting levels.
// Reach for `add` when you just want several objects under the same parent.
//
// `finalize()` tears down the Root Unit, releasing the renderer (destroy). The same release also runs
// on normal tree teardown, so the renderer is never leaked.
//
// - xpixi : { initialize, nest, add, remove, load, finalize, renderer, scene, canvas }
//----------------------------------------------------------------------------------------------------

import { xnew } from '@mulsense/xnew';
import * as PIXI from 'pixi.js'

export const xpixi = {
    initialize(
        { canvas }:
        { canvas: HTMLCanvasElement }
    ) {
        return xnew.promise(xnew(Root, { canvas }));
    },
    nest(object: any) {
        xnew(Nest, { object });
        xnew.extend(() => {
            return {
                get pixiObject() { return object; }
            }
        });
        return object;
    },
    add(object: any) {
        xnew(Add, { object });
        return object;
    },
    remove(object: any) {
        removeObject(object);
    },
    load(source: string | string[]): any {
        return xnew.promise(PIXI.Assets.load(source));
    },
    // Root unit を畳んで保持リソース（renderer）を解放する。
    finalize() {
        xnew.context(Root)?.release();
    },
    get renderer() {
        return xnew.context(Root)?.renderer;
    },
    get scene(): PIXI.Container {
        return xnew.context(Root)?.scene;
    },
    get canvas(): HTMLCanvasElement {
        return xnew.context(Root)?.canvas;
    },
};

function Root(unit: xnew.Unit, { canvas }: { canvas: HTMLCanvasElement }) {
    let renderer: PIXI.Renderer | null = null;
    xnew.promise(PIXI.autoDetectRenderer({
        width: canvas.width, height: canvas.height, view: canvas,
        antialias: true, backgroundAlpha: 0,
    })).then((value: any) => {
        renderer = value;
    });

    const scene = new PIXI.Container();

    // unit 破棄（明示的な xpixi.finalize / 通常のツリー破棄の両方）で renderer を解放する
    // （renderer は非同期生成のため null ガード）。
    unit.on('finalize', () => {
        renderer?.destroy();
    });

    return {
        get renderer() { return renderer; },
        get scene() { return scene; },
        get canvas() { return canvas; },
        release: () => unit.finalize(),
    }
}

// object を親から外したうえで GPU リソースを解放する。
// children: true で addChild した子（Graphics 等）も破棄。texture は既定（false）で
// 温存するため、共有テクスチャ（ベイク済み AnimatedSprite 等）は壊れない。
// destroyed ガードで、親の destroy({ children: true }) との二重破棄を防ぐ。
function removeObject(object: any): void {
    if (object.destroyed === true) return;
    const parent = object.parent;
    if (parent && parent.destroyed !== true) {
        parent.removeChild(object);
    }
    object.destroy({ children: true });
}

// 現在の Pixi 親（root scene か最も近い enclosing nest）へ object を追加し、finalize 時に
// 親から外して GPU リソースを解放する。nest / add の共有処理。
function attach(unit: xnew.Unit, object: any): void {
    const root = xnew.context(Root);
    const parent = xnew.context(Nest)?.pixiObject ?? root.scene;

    parent.addChild(object);
    unit.on('finalize', () => removeObject(object));
}

// nest: attach に加えて自身を pixiObject として公開する。これにより子孫ユニット（および同一
// ユニットの後続 nest）の `xnew.context(Nest)?.pixiObject` がこの object を解決し、親になる。
function Nest(unit: xnew.Unit, { object }: { object: any }) {
    attach(unit, object);
    return {
        get pixiObject() { return object; },
    }
}

// add: attach のみ。pixiObject を公開せず、context(Nest) のキーにも乗らない（Add で登録される）
// ため、現在の親を変えない。複数オブジェクトを同じ親へ兄弟として並べたいときに使う。
function Add(unit: xnew.Unit, { object }: { object: any }) {
    attach(unit, object);
}