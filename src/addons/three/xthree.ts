//----------------------------------------------------------------------------------------------------
// xthree — Three.js integration: ties the Three scene graph to the xnew unit tree
// The scene graph (Root / Nest / Add), and the bridge to the DOM over it (project / Pin), live here;
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
    // where a world point lands on the frame, as a fraction of it (0,0 top-left / 1,1 bottom-right); null behind the camera
    project,
    // a DOM element that rides a point of the scene — see the screen block below
    Pin,
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
// Fractions of the frame rather than pixels throughout, so a pin holds its place as the canvas resizes.
//----------------------------------------------------------------------------------------------------

export function project(point: THREE.Vector3): { x: number, y: number } | null {
    const camera = xnew.context(Root)?.camera as THREE.PerspectiveCamera;

    camera.updateMatrixWorld();
    const projected = point.clone().project(camera);

    // behind the camera w turns negative and x / y come back flipped, with z > 1 as the tell
    return projected.z > 1 ? null : { x: (projected.x + 1) / 2, y: (1 - projected.y) / 2 };
}

interface PinProps {
    /** the point the element's bottom edge sits on */
    point: () => THREE.Vector3 | null;
    /** the far end of the object: where the element slides to when `point` is off the top of the frame */
    toward?: () => THREE.Vector3 | null;
    /** the space kept between the point and the element, as a fraction of the frame height */
    gap?: number;
    /** the space kept between the top of the frame and the element, likewise */
    margin?: number;
}

/**
 * A DOM element that rides a point of the scene; the content is the caller's, added into it as usual.
 * Create it inside the positioned box holding the canvas (xbasics.Aspect's is one): left / top are
 * written as percentages of the offset parent, and the element measures itself against that same box.
 */
export function Pin(unit: xnew.Unit, { point, toward = () => null, gap = 0, margin = 0 }: PinProps): void {
    const css = xnew.css('base', {
        pin: `
                position: absolute; left: 0; top: 0;
                display: flex; flex-direction: column; align-items: center;
                transform: translate(-50%, -100%);
                white-space: nowrap; pointer-events: none; user-select: none;
            `,
    });

    xnew.nest({ tag: 'div', className: css.pin });

    // content added afterwards moves unit.current onto itself, so the element to place is caught here
    const element = unit.current as HTMLElement;

    let size = { width: 0, height: 0 };   // as a fraction of the box

    // measuring every frame would relayout against the left / top just written; the size is set in cq
    // units, so it only changes with the content, and the fraction survives a resize of the box
    unit.on('resize', () => {
        const box = element.parentElement;

        if (box !== null && box.clientWidth > 0 && box.clientHeight > 0) {
            size = { width: element.offsetWidth / box.clientWidth, height: element.offsetHeight / box.clientHeight };
        }
    });

    // the spot the bottom edge takes: on the point, or slid along the line to `toward` until it is inside the frame
    function spot(): { x: number, y: number } | null {
        const anchor = point();
        const from = anchor === null ? null : project(anchor);

        if (from === null) {
            return null;
        }

        const tail = toward();
        const to = tail === null ? null : project(tail);
        const limit = size.height + margin + gap;
        // sliding along the line keeps the element on its object; stopping at the edge would leave it floating
        const drop = to === null || from.y >= limit || to.y <= from.y ? 0 : Math.min(1, (limit - from.y) / (to.y - from.y));
        const x = to === null ? from.x : from.x + (to.x - from.x) * drop;
        const y = to === null ? from.y : from.y + (to.y - from.y) * drop;

        // across the frame it is only kept inside; unlike the drop, a small sideways shift costs nothing
        return { x: Math.min(1 - size.width / 2, Math.max(size.width / 2, x)), y: y - gap };
    }

    function follow(): void {
        const at = spot();

        // hidden rather than removed, so the size keeps being measurable while the point is unplaceable
        element.style.visibility = at === null ? 'hidden' : 'visible';

        if (at !== null) {
            element.style.left = `${at.x * 100}%`;
            element.style.top = `${at.y * 100}%`;
        }
    }
    follow();   // so the first frame is not spent in the corner of the box

    unit.on('update', follow);
}
