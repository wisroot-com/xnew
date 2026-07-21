//----------------------------------------------------------------------------------------------------
// xpixi — PixiJS 8 integration: ties the Pixi scene graph to the xnew unit tree
// nest() makes a group Container and moves the current parent into it (stateful); add(obj) attaches a
// leaf without moving — so a leaf can never become a parent. Objects are removed/destroyed on the
// owning unit's finalize (textures kept — they may be shared).
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
    // create a group Container, attach it, and move the current parent into it (stateful).
    // options set the new group's transform only — an existing object can never be nested.
    nest(
        options?: {
            position?: { x: number, y: number },
            scale?: number | { x: number, y: number },
            rotation?: number,
        }
    ): PIXI.Container {
        const object = new PIXI.Container();
        if (options !== undefined) {
            const { position, scale, rotation } = options;
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
    let finalized = false;

    // autoDetectRenderer resolves to an already-created WebGL renderer; watch the raw promise (not the
    // scope-guarded xnew.promise chain, which is skipped after finalize) so a renderer that lands post-finalize is destroyed
    const source = PIXI.autoDetectRenderer({
        width: canvas.width, height: canvas.height, view: canvas,
        antialias: true, backgroundAlpha: 0,
    });
    xnew.promise(source);
    source.then((value: any) => {
        if (finalized === true) {
            value.destroy();
        } else {
            renderer = value;
        }
    });

    const scene = new PIXI.Container();

    unit.on('finalize', () => {
        finalized = true;
        renderer?.destroy();
        renderer = null;
    });

    return {
        get renderer() { return renderer; },
        get scene() { return scene; },
        get canvas() { return canvas; },
    }
}

// destroy the object and its children, but keep textures (default) since they may be shared;
// the destroyed guard avoids double-destroy against a parent's destroy({ children: true })
function removeObject(object: any): void {
    if (object.destroyed === true) return;
    const parent = object.parent;
    if (parent && parent.destroyed !== true) {
        parent.removeChild(object);
    }
    object.destroy({ children: true });
}

// shared by nest / add: attach to the current Pixi parent (root scene or nearest enclosing nest),
// remove and destroy on finalize
function attach(unit: xnew.Unit, object: any): void {
    const root = xnew.context(Root);
    const parent = xnew.context(Nest)?.pixiObject ?? root.scene;

    parent.addChild(object);
    unit.on('finalize', () => removeObject(object));
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