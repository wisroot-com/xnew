//----------------------------------------------------------------------------------------------------
// xthree — Three.js integration
//
// Ties the Three scene graph to the xnew unit tree: objects attached via nest / add are detached
// automatically when the owning unit finalizes, and the renderer + WebGL context are released when
// the unit that called initialize finalizes. Detach never disposes GPU resources (geometry /
// material / texture may be shared) — release them explicitly with dispose.
//
// - initialize({ canvas, camera }) : mount the Root unit owning WebGLRenderer + Scene + Camera
// - nest(object3D)                 : attach AND make this object the current parent
// - add(object3D)                  : attach only; the current parent stays unchanged (siblings)
// - dispose(object3D)              : detach and dispose its geometry / material / texture
// - coord2dTo3d / coord3dTo2d      : convert between canvas pixels and world space via the camera
// - renderer / camera / scene / canvas : Root unit accessors
//
// Caveat: nest is stateful — two nest calls in the same unit create two nesting levels;
// use add to place several objects under the same parent.
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
    // detach and release all GPU resources; assumes they are not shared elsewhere
    dispose(object: any) {
        object.parent?.remove(object);
        disposeObject(object);
    },
    coord2dTo3d(x: number, y: number, z: number = 0): THREE.Vector3 {
        const root = xnew.context(Root);
        const camera = root.camera as THREE.Camera;
        camera.updateMatrixWorld();
        const nx = (x / root.canvas.width) * 2 - 1;
        const ny = -(y / root.canvas.height) * 2 + 1;
        // unproject near / far to build the view ray, then intersect the world z plane (works for perspective / orthographic)
        const near = new THREE.Vector3(nx, ny, -1).unproject(camera);
        const direction = new THREE.Vector3(nx, ny, +1).unproject(camera).sub(near);
        return near.add(direction.multiplyScalar((z - near.z) / direction.z));
    },
    coord3dTo2d(x: number, y: number, z: number): THREE.Vector2 {
        const root = xnew.context(Root);
        const camera = root.camera as THREE.Camera;
        camera.updateMatrixWorld();
        const projected = new THREE.Vector3(x, y, z).project(camera);
        return new THREE.Vector2((projected.x + 1) / 2 * root.canvas.width, (1 - projected.y) / 2 * root.canvas.height);
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

    // release the renderer + WebGL context on tree teardown
    unit.on('finalize', () => {
        renderer.dispose();
        renderer.forceContextLoss?.();
    });

    return {
        get canvas() { return canvas; },
        get camera() { return camera; },
        get renderer() { return renderer; },
        get scene() { return scene; },
    }
}

// traverse the object and dispose geometry / material / texture
function disposeObject(object: any): void {
    object.traverse((obj: any) => {
        if (!obj.isMesh) return;
        obj.geometry?.dispose();
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const material of materials) {
            if (!material) continue;
            // dispose textures referenced by the material
            for (const key in material) {
                const value = material[key];
                if (value && value.isTexture) value.dispose();
            }
            material.dispose();
        }
    });
}

// shared by nest / add: attach to the current Three parent (root scene or nearest enclosing nest),
// detach (never dispose) on finalize
function attach(unit: xnew.Unit, object: any): void {
    const root = xnew.context(Root);
    const parent = xnew.context(Nest)?.threeObject ?? root.scene;

    parent.add(object);
    unit.on('finalize', () => {
        parent.remove(object);
    });
}

// exposes threeObject so descendant units (and later nests) resolve this object as their parent
function Nest(unit: xnew.Unit, { object }: { object: any }) {
    attach(unit, object);
    return {
        get threeObject() { return object; }
    };
}

// no threeObject exposure — the current parent stays unchanged
function Add(unit: xnew.Unit, { object }: { object: any }) {
    attach(unit, object);
}
