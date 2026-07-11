import { xnew } from '@mulsense/xnew';
import * as THREE from 'three';

const xthree = {
    initialize({ canvas, camera = null }) {
        return xnew.promise(xnew(Root, { canvas, camera }));
    },
    nest(object) {
        xnew(Nest, { object });
        xnew.extend(() => {
            return {
                get threeObject() { return object; }
            };
        });
        return object;
    },
    add(object) {
        xnew(Add, { object });
        return object;
    },
    dispose(object) {
        var _a;
        (_a = object.parent) === null || _a === void 0 ? void 0 : _a.remove(object);
        disposeObject(object);
    },
    coord2dTo3d(x, y, z = 0) {
        const root = xnew.context(Root);
        const camera = root.camera;
        camera.updateMatrixWorld();
        const nx = (x / root.canvas.width) * 2 - 1;
        const ny = -(y / root.canvas.height) * 2 + 1;
        const near = new THREE.Vector3(nx, ny, -1).unproject(camera);
        const direction = new THREE.Vector3(nx, ny, +1).unproject(camera).sub(near);
        return near.add(direction.multiplyScalar((z - near.z) / direction.z));
    },
    coord3dTo2d(x, y, z) {
        const root = xnew.context(Root);
        const camera = root.camera;
        camera.updateMatrixWorld();
        const projected = new THREE.Vector3(x, y, z).project(camera);
        return new THREE.Vector2((projected.x + 1) / 2 * root.canvas.width, (1 - projected.y) / 2 * root.canvas.height);
    },
    get renderer() {
        var _a;
        return (_a = xnew.context(Root)) === null || _a === void 0 ? void 0 : _a.renderer;
    },
    get camera() {
        var _a;
        return (_a = xnew.context(Root)) === null || _a === void 0 ? void 0 : _a.camera;
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
function Root(unit, { canvas, camera }) {
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
    renderer.setClearColor(0x000000, 0);
    camera = camera !== null && camera !== void 0 ? camera : new THREE.PerspectiveCamera(45, renderer.domElement.width / renderer.domElement.height);
    const scene = new THREE.Scene();
    unit.on('finalize', () => {
        var _a;
        renderer.dispose();
        (_a = renderer.forceContextLoss) === null || _a === void 0 ? void 0 : _a.call(renderer);
    });
    return {
        get canvas() { return canvas; },
        get camera() { return camera; },
        get renderer() { return renderer; },
        get scene() { return scene; },
    };
}
function disposeObject(object) {
    object.traverse((obj) => {
        var _a;
        if (!obj.isMesh)
            return;
        (_a = obj.geometry) === null || _a === void 0 ? void 0 : _a.dispose();
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const material of materials) {
            if (!material)
                continue;
            for (const key in material) {
                const value = material[key];
                if (value && value.isTexture)
                    value.dispose();
            }
            material.dispose();
        }
    });
}
function attach(unit, object) {
    var _a, _b;
    const root = xnew.context(Root);
    const parent = (_b = (_a = xnew.context(Nest)) === null || _a === void 0 ? void 0 : _a.threeObject) !== null && _b !== void 0 ? _b : root.scene;
    parent.add(object);
    unit.on('finalize', () => {
        parent.remove(object);
    });
}
function Nest(unit, { object }) {
    attach(unit, object);
    return {
        get threeObject() { return object; }
    };
}
function Add(unit, { object }) {
    attach(unit, object);
}

export { xthree };
