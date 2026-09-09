import { xnew, xbasics } from '@mulsense/xnew';
import * as PIXI from 'pixi.js';

/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
/* global Reflect, Promise, SuppressedError, Symbol, Iterator */


function __rest(s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
}

typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};

const xpixi = {
    init({ canvas }) {
        return xnew.promise(xnew(Root, { canvas }));
    },
    nest(transform) {
        const object = new PIXI.Container();
        if (transform !== undefined) {
            const { position, scale, rotation } = transform;
            if (position !== undefined) {
                object.position.set(position.x, position.y);
            }
            if (scale !== undefined) {
                if (typeof scale === 'number') {
                    object.scale.set(scale);
                }
                else {
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
            };
        });
        return object;
    },
    add(object) {
        xnew(Add, { object });
        return object;
    },
    project,
    Pin,
    get renderer() {
        var _a;
        return (_a = xnew.context(Root)) === null || _a === void 0 ? void 0 : _a.renderer;
    },
    get scene() {
        var _a;
        return (_a = xnew.context(Root)) === null || _a === void 0 ? void 0 : _a.scene;
    },
    get canvas() {
        var _a;
        return (_a = xnew.context(Root)) === null || _a === void 0 ? void 0 : _a.canvas;
    },
};
function Root(unit, { canvas }) {
    let renderer = null;
    let destroyed = false;
    const source = PIXI.autoDetectRenderer({
        width: canvas.width, height: canvas.height, view: canvas,
        antialias: true, backgroundAlpha: 0,
    });
    xnew.promise(source);
    source.then((value) => {
        if (destroyed === true) {
            value.destroy();
        }
        else {
            renderer = value;
        }
    });
    const scene = new PIXI.Container();
    unit.on('destroy', () => {
        destroyed = true;
        renderer === null || renderer === void 0 ? void 0 : renderer.destroy();
        renderer = null;
    });
    return {
        get renderer() { return renderer; },
        get scene() { return scene; },
        get canvas() { return canvas; },
    };
}
function removeObject(object) {
    if (object.destroyed === true)
        return;
    const parent = object.parent;
    if (parent && parent.destroyed !== true) {
        parent.removeChild(object);
    }
    object.destroy({ children: true });
}
function attach(unit, object) {
    var _a, _b;
    const root = xnew.context(Root);
    const parent = (_b = (_a = xnew.context(Nest)) === null || _a === void 0 ? void 0 : _a.pixiObject) !== null && _b !== void 0 ? _b : root.scene;
    parent.addChild(object);
    unit.on('destroy', () => removeObject(object));
}
function Nest(unit, { object }) {
    attach(unit, object);
    return {
        get pixiObject() { return object; },
    };
}
function Add(unit, { object }) {
    attach(unit, object);
}
function project(point, from) {
    var _a, _b, _c;
    const root = xnew.context(Root);
    const parent = (_b = from !== null && from !== void 0 ? from : (_a = xnew.context(Nest)) === null || _a === void 0 ? void 0 : _a.pixiObject) !== null && _b !== void 0 ? _b : root.scene;
    const screen = (_c = root.renderer) === null || _c === void 0 ? void 0 : _c.screen;
    if (screen === undefined || screen.width === 0 || screen.height === 0) {
        return null;
    }
    const global = parent.toGlobal(point);
    return { x: global.x / screen.width, y: global.y / screen.height };
}
function Pin(unit, _a) {
    var { point, toward = () => null, space } = _a, others = __rest(_a, ["point", "toward", "space"]);
    const projected = (get) => () => {
        const local = get();
        return local === null ? null : project(local, space);
    };
    xnew.extend(xbasics.Pin, Object.assign({ point: projected(point), toward: projected(toward) }, others));
}

export { Pin, project, xpixi };
