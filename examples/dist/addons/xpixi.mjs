import { xnew } from '@mulsense/xnew';
import * as PIXI from 'pixi.js';

const xpixi = {
    initialize({ canvas }) {
        return xnew.promise(xnew(Root, { canvas }));
    },
    nest(object) {
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
    remove(object) {
        removeObject(object);
    },
    load(source) {
        return xnew.promise(PIXI.Assets.load(source));
    },
    finalize() {
        var _a;
        (_a = xnew.context(Root)) === null || _a === void 0 ? void 0 : _a.release();
    },
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
    xnew.promise(PIXI.autoDetectRenderer({
        width: canvas.width, height: canvas.height, view: canvas,
        antialias: true, backgroundAlpha: 0,
    })).then((value) => {
        renderer = value;
    });
    const scene = new PIXI.Container();
    unit.on('finalize', () => {
        renderer === null || renderer === void 0 ? void 0 : renderer.destroy();
    });
    return {
        get renderer() { return renderer; },
        get scene() { return scene; },
        get canvas() { return canvas; },
        release: () => unit.finalize(),
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
    unit.on('finalize', () => removeObject(object));
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

export { xpixi };
