//----------------------------------------------------------------------------------------------------
// xpixi — PixiJS 8 integration: ties the Pixi scene graph to the xnew unit tree
// nest() makes a group Container and moves the current parent into it (stateful); add(obj) attaches
// a leaf without moving. Objects are removed and destroyed with their unit (textures kept — may be shared).
//----------------------------------------------------------------------------------------------------

import { xnew } from '@mulsense/xnew';
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