//----------------------------------------------------------------------------------------------------
// graph — the scene-graph half of xthree: the Root / Nest / Add units and the attach helpers
// Split out of xthree.ts so models/ can nest and add without importing the facade back (cycle-free).
//----------------------------------------------------------------------------------------------------

import { xnew } from '@mulsense/xnew';
import * as THREE from 'three';

// the transform a group / model is placed with; z is optional so 2D-ish placement stays short
export interface Transform {
    position?: { x: number, y: number, z?: number },
    scale?: number | { x: number, y: number, z?: number },
    rotation?: { x: number, y: number, z?: number },
}

export function initialize(
    { canvas, camera = null }:
    { canvas: HTMLCanvasElement, camera?: THREE.Camera | null }
) {
    return xnew.promise(xnew(Root, { canvas, camera }));
}

// create a group Object3D and move the current parent into it (stateful); options set its transform only — never an existing object.
export function nest(options?: Transform): THREE.Group {
    const object = new THREE.Group();
    if (options !== undefined) {
        applyTransform(object, options);
    }
    xnew(Nest, { object });
    xnew.extend(() => {
        return {
            get threeObject() { return object; }
        }
    });
    return object;
}

// attach a display object to the current parent; the current parent stays unchanged
export function add(object: any) {
    xnew(Add, { object });
    return object;
}

// shared by nest and the models' placement props, so both read the same option shape
export function applyTransform(object: THREE.Object3D, { position, scale, rotation }: Transform): void {
    if (position !== undefined) {
        object.position.set(position.x, position.y, position.z ?? 0);
    }
    if (scale !== undefined) {
        if (typeof scale === 'number') {
            object.scale.set(scale, scale, scale);
        } else {
            object.scale.set(scale.x, scale.y, scale.z ?? 1);
        }
    }
    if (rotation !== undefined) {
        object.rotation.set(rotation.x, rotation.y, rotation.z ?? 0);
    }
}

export function Root(unit: xnew.Unit, { canvas, camera }: any) {
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

// shared by nest / add: attach to the current Three parent (root scene or nearest enclosing nest), detach (never dispose) on finalize
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
