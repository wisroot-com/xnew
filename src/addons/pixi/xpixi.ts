//----------------------------------------------------------------------------------------------------
// xpixi — PixiJS 8 integration: ties the Pixi scene graph to the xnew unit tree
// nest() makes a group Container and moves the current parent into it (stateful); add(obj) attaches
// a leaf without moving. Objects are removed and destroyed with their unit (textures kept — may be shared).
// The bridge to the DOM over the canvas (project / Pin) sits at the bottom, mirroring xthree's.
//----------------------------------------------------------------------------------------------------

import { xnew, xbasics } from '@mulsense/xnew';
import * as PIXI from 'pixi.js'

// the transform a group is placed with; 2D, so rotation is a single angle
interface Transform {
    position?: { x: number, y: number },
    scale?: number | { x: number, y: number },
    rotation?: number,
}

export const xpixi = {
    init({ canvas }: { canvas: HTMLCanvasElement }) {
        return xnew.promise(xnew(Root, { canvas }));
    },
    // create a group Container and move the current parent into it (stateful); the transform applies to the new group only — never an existing object.
    nest(transform?: Transform): PIXI.Container {
        const object = new PIXI.Container();
        if (transform !== undefined) {
            const { position, scale, rotation } = transform;
            if (position !== undefined) {
                object.position.set(position.x, position.y);
            }
            if (scale !== undefined) {
                if (typeof scale === 'number') {
                    object.scale.set(scale);
                } else {
                    object.scale.set(scale.x, scale.y);
                }
            }
            if (rotation !== undefined) {
                object.rotation = rotation;
            }
        }
        xnew(Nest, { object });
        xnew.extend(() => {
            return {
                get pixiObject() { return object; }
            }
        });
        return object;
    },
    // attach a display object to the current parent; the current parent stays unchanged
    add(object: any) {
        xnew(Add, { object });
        return object;
    },
    // where a local point of the current parent lands on the canvas, as a fraction of it (0,0 top-left / 1,1 bottom-right)
    project,
    // a DOM element that rides a point of the scene — see the screen block below
    Pin,
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
    let destroyed = false;

    // watch the raw promise (the scope-guarded xnew.promise chain is skipped once the unit is destroyed) so a renderer landing after that is destroyed too
    const source = PIXI.autoDetectRenderer({
        width: canvas.width, height: canvas.height, view: canvas,
        antialias: true, backgroundAlpha: 0,
    });
    xnew.promise(source);
    source.then((value: any) => {
        if (destroyed === true) {
            value.destroy();
        } else {
            renderer = value;
        }
    });

    const scene = new PIXI.Container();

    unit.on('destroy', () => {
        destroyed = true;
        renderer?.destroy();
        renderer = null;
    });

    return {
        get renderer() { return renderer; },
        get scene() { return scene; },
        get canvas() { return canvas; },
    }
}

// destroy the object and its children but keep textures (may be shared); the destroyed guard avoids double-destroy via a parent
function removeObject(object: any): void {
    if (object.destroyed === true) return;
    const parent = object.parent;
    if (parent && parent.destroyed !== true) {
        parent.removeChild(object);
    }
    object.destroy({ children: true });
}

// shared by nest / add: attach to the current Pixi parent (root scene or nearest enclosing nest), removed and destroyed with the unit
function attach(unit: xnew.Unit, object: any): void {
    const root = xnew.context(Root);
    const parent = xnew.context(Nest)?.pixiObject ?? root.scene;

    parent.addChild(object);
    unit.on('destroy', () => removeObject(object));
}

// exposes pixiObject so descendant units (and later nests) resolve this object as their parent
function Nest(unit: xnew.Unit, { object }: { object: any }) {
    attach(unit, object);
    return {
        get pixiObject() { return object; },
    }
}

// no pixiObject exposure — the current parent stays unchanged
function Add(unit: xnew.Unit, { object }: { object: any }) {
    attach(unit, object);
}

//----------------------------------------------------------------------------------------------------
// screen — the bridge from the scene to the DOM laid over it
// Only the projection is 2D-specific: a point in the current parent's space out as a fraction of the
// canvas. Placing a DOM element on that fraction is xbasics.Pin's job, shared with xthree.
//----------------------------------------------------------------------------------------------------

// null until the renderer has resolved (its screen size is what the fraction is taken against), so a pin written before init just stays hidden.
export function project(point: { x: number, y: number }, from?: PIXI.Container): { x: number, y: number } | null {
    const root = xnew.context(Root);
    const parent = from ?? xnew.context(Nest)?.pixiObject ?? root.scene;
    const screen = root.renderer?.screen;

    if (screen === undefined || screen.width === 0 || screen.height === 0) {
        return null;
    }
    const global = parent.toGlobal(point);

    return { x: global.x / screen.width, y: global.y / screen.height };
}

interface PinProps {
    // the point the element's bottom edge sits on, in `space`'s coordinates
    point: () => { x: number, y: number } | null;
    // the container the point is read in; the current parent when left out
    space?: PIXI.Container;
    // the space kept between the point and the element, as a fraction of the box height
    gap?: number;
    // the element the projection lands on (the canvas on screen); omit it when the pin sits in that very box
    frame?: HTMLElement;
}

// xbasics.Pin with the projection on it (see there for the box it wants); the point is read in `space`, else in the parent the caller's nest resolves to — so a pin written beside the object it follows reads that object's space.
export function Pin(unit: xnew.Unit, { point, space, ...others }: PinProps): void {
    function projected(): { x: number, y: number } | null {
        const local = point();
        return local === null ? null : project(local, space);
    }

    xnew.extend(xbasics.Pin, { point: projected, ...others });
}
