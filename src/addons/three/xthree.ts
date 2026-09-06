//----------------------------------------------------------------------------------------------------
// xthree — Three.js integration: ties the Three scene graph to the xnew unit tree
// The scene graph (Root / Nest / Add and the attach helpers) lives here; the texture-backed materials
// are in ./material. Ready-made models (畳・ちゃぶ台 など) are not xnew's job — they live in the
// xnew-gamelab package, built on the public surface at the bottom of this file.
//----------------------------------------------------------------------------------------------------

import { xnew } from '@mulsense/xnew';
import * as THREE from 'three';
import { material } from './material';

//----------------------------------------------------------------------------------------------------
// scene graph
//----------------------------------------------------------------------------------------------------

// the transform a group / model is placed with; z is optional so 2D-ish placement stays short
export interface Transform {
    position?: { x: number, y: number, z?: number },
    scale?: number | { x: number, y: number, z?: number },
    rotation?: { x: number, y: number, z?: number },
}

function initialize(
    { canvas, camera = null }:
    { canvas: HTMLCanvasElement, camera?: THREE.Camera | null }
) {
    return xnew.promise(xnew(Root, { canvas, camera }));
}

// create a group Object3D and move the current parent into it (stateful); options set its transform only — never an existing object.
function nest(options?: Transform): THREE.Group {
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
function add(object: any) {
    xnew(Add, { object });
    return object;
}

// shared by nest and anything else placing an object, so they all read the same option shape
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

//----------------------------------------------------------------------------------------------------
// the public surface
//----------------------------------------------------------------------------------------------------

export const xthree = {
    initialize,
    // create a group Object3D and move the current parent into it (stateful); options set its transform only — never an existing object.
    nest,
    // attach a display object to the current parent; the current parent stays unchanged
    add,
    // build a three material from an xtextures texture object (see material.ts)
    material,
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
