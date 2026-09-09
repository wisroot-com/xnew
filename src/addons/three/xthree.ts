//----------------------------------------------------------------------------------------------------
// xthree — Three.js integration: ties the Three scene graph to the xnew unit tree
// The scene graph (Root / Nest / Add), and the bridge to the DOM over it (project / Pin / Plane), live here;
// materials are in ./material. Ready-made models are xnew-gamelab's, built on the public surface below.
//----------------------------------------------------------------------------------------------------

import { xnew } from '@mulsense/xnew';
import * as THREE from 'three';
import { material } from './material';

// the transform a group / model is placed with; z is optional so 2D-ish placement stays short
interface Transform {
    position?: { x: number, y: number, z?: number },
    scale?: number | { x: number, y: number, z?: number },
    rotation?: { x: number, y: number, z?: number },
}

//----------------------------------------------------------------------------------------------------
// the public surface
//----------------------------------------------------------------------------------------------------

export const xthree = {
    init({ canvas, camera = null }: { canvas: HTMLCanvasElement, camera?: THREE.Camera | null }) {
        return xnew.promise(xnew(Root, { canvas, camera }));
    },
    // create a group Object3D and move the current parent into it (stateful); the transform applies to the new group only — never an existing object.
    nest(transform?: Transform): THREE.Group {
        const object = new THREE.Group();
        if (transform !== undefined) {
            const { position, scale, rotation } = transform;
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
        xnew(Nest, { object });
        xnew.extend(() => {
            return {
                get threeObject() { return object; }
            }
        });
        return object;
    },
    // attach a display object to the current parent; the current parent stays unchanged
    add(object: any) {
        xnew(Add, { object });
        return object;
    },
    // build a three material from an xtextures texture object: material(texture, options), where
    // options.type is 'shader' | 'bake' | 'inject' ('bake' when omitted) — see material.ts
    material,
    // where a point of an object lands on the frame, as a fraction of it (0,0 top-left / 1,1 bottom-right); null behind the camera — what xbasics.Pin takes
    project,
    // how an object is seen from the camera, as a matrix and the fov it is measured against — what xbasics.Plane takes
    view,
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

//----------------------------------------------------------------------------------------------------
// scene graph
//----------------------------------------------------------------------------------------------------

function Root(unit: xnew.Unit, { canvas, camera }: { canvas: HTMLCanvasElement, camera?: THREE.Camera | null }) {
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
    renderer.setClearColor(0x000000, 0);

    camera = camera ?? new THREE.PerspectiveCamera(45, renderer.domElement.width / renderer.domElement.height);
    const scene = new THREE.Scene();

    // release the renderer + WebGL context on tree teardown
    unit.on('destroy', () => {
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

// shared by nest / add: attach to the current Three parent (root scene or nearest enclosing nest), detached (never disposed) with the unit
function attach(unit: xnew.Unit, object: any): void {
    const root = xnew.context(Root);
    const parent = xnew.context(Nest)?.threeObject ?? root.scene;

    parent.add(object);
    unit.on('destroy', () => {
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
// screen — the bridge from the scene to the DOM laid over it
// Only the viewing is 3D: a world point becomes a fraction of the canvas, a world transform a view one.
// Placing DOM on either is plain DOM work, so these two feed xbasics.Pin / xbasics.Plane and stop there.
//----------------------------------------------------------------------------------------------------

// where a point given in the object's own space lands on the frame; pass xthree.scene as the object for a world point
export function project(object: THREE.Object3D, point: THREE.Vector3): { x: number, y: number } | null {
    const camera = xnew.context(Root)?.camera as THREE.PerspectiveCamera;

    camera.updateMatrixWorld();
    // localToWorld brings the object's own chain up to date first; the renderer only does it at render(), which is the last thing in the frame
    const projected = object.localToWorld(point.clone()).project(camera);

    // behind the camera w turns negative and x / y come back flipped, with z > 1 as the tell
    return projected.z > 1 ? null : { x: (projected.x + 1) / 2, y: (1 - projected.y) / 2 };
}

// the object's place as xbasics.Plane wants it: an object-to-view matrix and the fov it is measured against, read together so a camera moved mid-frame cannot mix the two
export function view(object: THREE.Object3D): { matrix: number[], fov: number } {
    const camera = xnew.context(Root)?.camera as THREE.PerspectiveCamera;

    camera.updateMatrixWorld();
    // the scene is rendered after the caller's unit updates, so the object's own chain is brought up to date here or the plane trails a frame
    object.updateWorldMatrix(true, false);

    return {
        matrix: new THREE.Matrix4().multiplyMatrices(camera.matrixWorldInverse, object.matrixWorld).elements,
        fov: camera.fov,
    };
}
