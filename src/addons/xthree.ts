//----------------------------------------------------------------------------------------------------
// xthree — Three.js integration
//
// `initialize({ canvas, camera })` mounts a Root Unit that owns a WebGLRenderer + Scene + Camera.
// Two ways to attach a THREE object to the current Three parent (root scene or nearest enclosing nest):
//   - `nest(object3D)` : attach AND make this object the current parent — subsequent nests in
//                        descendant units (and later nests in the same unit) go *inside* it.
//   - `add(object3D)`  : attach only; does NOT change the current parent (use to place siblings).
// Both only *detach* the object from its parent on Unit finalize — they do NOT dispose geometry /
// material / texture, because those resources may be shared across models or cached by the app.
// `remove(object3D)` likewise detaches only. To release GPU resources, call `dispose(object3D)`
// explicitly: it detaches AND disposes the object's geometry / material / texture.
//
// Caveat: `nest` is stateful — two `nest` calls in the same unit produce two nesting levels.
// Reach for `add` when you just want several objects under the same parent.
//
// `finalize()` tears down the Root Unit, releasing the renderer (dispose + forceContextLoss). The same
// release also runs on normal tree teardown, so the WebGL context is never leaked.
// `coord2dTo3d(x, y, z)` / `coord3dTo2d(x, y, z)` convert between canvas pixels and world space
// through the camera (2d→3d intersects the view ray with the world z plane), so 2D overlays and
// 3D placement stay consistent without hand-tuned scale factors.
//
// - xthree : { initialize, nest, add, remove, dispose, finalize, coord2dTo3d, coord3dTo2d,
//              renderer, camera, scene, canvas }
//----------------------------------------------------------------------------------------------------

import { xnew } from '@mulsense/xnew';
import * as THREE from 'three';

export const xthree = {
    initialize (
        { canvas, camera = null }:
        { canvas: HTMLCanvasElement, camera?: THREE.Camera | null }
    ) {
        return xnew.promise(xnew(Root, { canvas, camera }));
    },
    nest(object: any) {
        xnew(Nest, { object });
        xnew.extend(() => {
            return {
                get threeObject() { return object; }
            }
        });
        return object;
    },
    add(object: any) {
        xnew(Add, { object });
        return object;
    },
    // 親から外すだけ。GPU リソース（geometry / material / texture）は解放しない。
    // 共有・キャッシュされている可能性があるため、解放は明示的な dispose に委ねる。
    remove(object: any) {
        object.parent?.remove(object);
    },
    // 親から外したうえで、配下の geometry / material / texture を辿って dispose し、
    // GPU リソースを明示的に全解放する。テクスチャ等を他で共有していないことが前提。
    dispose(object: any) {
        object.parent?.remove(object);
        disposeObject(object);
    },
    // canvas ピクセル座標 (x, y) を、カメラから見てワールド z 平面上に載る 3D 座標へ変換する。
    coord2dTo3d(x: number, y: number, z: number = 0): THREE.Vector3 {
        const root = xnew.context(Root);
        const camera = root.camera as THREE.Camera;
        camera.updateMatrixWorld();
        const nx = (x / root.canvas.width) * 2 - 1;
        const ny = -(y / root.canvas.height) * 2 + 1;
        // near / far 面の逆投影で視線レイを作り、z 平面との交点を取る（perspective / orthographic 共通）。
        const near = new THREE.Vector3(nx, ny, -1).unproject(camera);
        const direction = new THREE.Vector3(nx, ny, +1).unproject(camera).sub(near);
        return near.add(direction.multiplyScalar((z - near.z) / direction.z));
    },
    // ワールド座標 (x, y, z) を canvas ピクセル座標へ変換する。
    coord3dTo2d(x: number, y: number, z: number): THREE.Vector2 {
        const root = xnew.context(Root);
        const camera = root.camera as THREE.Camera;
        camera.updateMatrixWorld();
        const projected = new THREE.Vector3(x, y, z).project(camera);
        return new THREE.Vector2((projected.x + 1) / 2 * root.canvas.width, (1 - projected.y) / 2 * root.canvas.height);
    },
    // Root unit を畳んで保持リソース（renderer + WebGL コンテキスト）を解放する。
    finalize() {
        xnew.context(Root)?.release();
    },
    get renderer() {
        return xnew.context(Root)?.renderer;
    },
    get camera(): THREE.Camera {
        return xnew.context(Root)?.camera;
    },
    get scene(): THREE.Scene {
        return xnew.context(Root)?.scene;
    },
    get canvas(): HTMLCanvasElement {
        return xnew.context(Root)?.canvas;
    },
};

function Root(unit: xnew.Unit, { canvas, camera }: any) {
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
    renderer.setClearColor(0x000000, 0);

    camera = camera ?? new THREE.PerspectiveCamera(45, renderer.domElement.width / renderer.domElement.height);
    const scene = new THREE.Scene();

    // unit 破棄（明示的な xthree.finalize / 通常のツリー破棄の両方）で GPU リソースを解放する。
    unit.on('finalize', () => {
        renderer.dispose();
        renderer.forceContextLoss?.();
    });

    return {
        get canvas() { return canvas; },
        get camera() { return camera; },
        get renderer() { return renderer; },
        get scene() { return scene; },
        release: () => unit.finalize(),
    }
}

// object 配下の geometry / material / texture を辿って dispose し、GPU リソースを解放する。
function disposeObject(object: any): void {
    object.traverse((obj: any) => {
        if (!obj.isMesh) return;
        obj.geometry?.dispose();
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const material of materials) {
            if (!material) continue;
            // material が参照する texture も解放する
            for (const key in material) {
                const value = material[key];
                if (value && value.isTexture) value.dispose();
            }
            material.dispose();
        }
    });
}

// 現在の THREE 親（root scene か最も近い enclosing nest）へ object を追加し、finalize 時に
// 親から外す（detach のみ）。GPU リソースは共有の可能性があるため dispose しない。nest / add の共有処理。
function attach(unit: xnew.Unit, object: any): void {
    const root = xnew.context(Root);
    const parent = xnew.context(Nest)?.threeObject ?? root.scene;

    parent.add(object);
    unit.on('finalize', () => {
        parent.remove(object);
    });
}

// nest: attach に加えて自身を threeObject として公開する。これにより子孫ユニット（および同一
// ユニットの後続 nest）の `xnew.context(Nest)?.threeObject` がこの object を解決し、親になる。
function Nest(unit: xnew.Unit, { object }: { object: any }) {
    attach(unit, object);
    return {
        get threeObject() { return object; }
    };
}

// add: attach のみ。threeObject を公開せず、context(Nest) のキーにも乗らない（Add で登録される）
// ため、現在の親を変えない。複数オブジェクトを同じ親へ兄弟として並べたいときに使う。
function Add(unit: xnew.Unit, { object }: { object: any }) {
    attach(unit, object);
}
