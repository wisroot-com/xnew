import { xnew } from '@mulsense/xnew';
import * as THREE from 'three';

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

const xthree = {
    initialize({ canvas, camera = null }) {
        return xnew.promise(xnew(Root, { canvas, camera }));
    },
    nest(options) {
        var _a, _b, _c;
        const object = new THREE.Group();
        if (options !== undefined) {
            const { position, scale, rotation } = options;
            if (position !== undefined) {
                object.position.set(position.x, position.y, (_a = position.z) !== null && _a !== void 0 ? _a : 0);
            }
            if (scale !== undefined) {
                if (typeof scale === 'number') {
                    object.scale.set(scale, scale, scale);
                }
                else {
                    object.scale.set(scale.x, scale.y, (_b = scale.z) !== null && _b !== void 0 ? _b : 1);
                }
            }
            if (rotation !== undefined) {
                object.rotation.set(rotation.x, rotation.y, (_c = rotation.z) !== null && _c !== void 0 ? _c : 0);
            }
        }
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
    material: {
        shader(texture, params) {
            var _a;
            const def = texture;
            if (def.color === undefined || def.normal === undefined) {
                throw new Error(`xthree.material.shader: texture "${def.name}" must carry color and normal channels`);
            }
            const uniforms = {};
            for (const name in def.uniforms) {
                const value = (_a = params[name]) !== null && _a !== void 0 ? _a : def.uniforms[name].value;
                uniforms[name] = { value: Array.isArray(value) ? new THREE.Vector3(value[0], value[1], value[2]) : value };
            }
            const vertexShader = `
                varying vec3 vXtexPos;
                varying vec3 vXtexNormal;
                varying vec3 vXtexLight;
                void main() {
                    vXtexPos = position;
                    vXtexNormal = normal;
                    // rotate the view-space light into object space: transpose(mat3(mv)) * light
                    mat3 mv = mat3(modelViewMatrix);
                    vec3 light = normalize(vec3(0.4, 0.7, 0.6));
                    vXtexLight = vec3(dot(mv[0], light), dot(mv[1], light), dot(mv[2], light));
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `;
            const fragmentShader = `
                varying vec3 vXtexPos;
                varying vec3 vXtexNormal;
                varying vec3 vXtexLight;
                ${def.glsl}
                void main() {
                    vec3 nrm = normalize(vXtexNormal);
                    vec3 tng = normalize(abs(nrm.y) < 0.99 ? cross(vec3(0.0, 1.0, 0.0), nrm) : cross(vec3(1.0, 0.0, 0.0), nrm));
                    vec3 n = ${def.normal}(vXtexPos, nrm, tng);
                    vec3 albedo = ${def.color}(vXtexPos);
                    float diff = 0.55 + 0.45 * max(dot(n, normalize(vXtexLight)), 0.0);
                    gl_FragColor = vec4(albedo * diff, 1.0);
                }
            `;
            return new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader });
        },
        standard(texture, options) {
            const { params, size, worldSize, tile, repeat } = options, materialParams = __rest(options, ["params", "size", "worldSize", "tile", "repeat"]);
            function bake(channel) {
                const map = new THREE.CanvasTexture(texture.bake({ params, size, worldSize, tile, channel }));
                map.colorSpace = channel === 'color' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
                map.anisotropy = 8;
                if (repeat !== undefined) {
                    map.wrapS = map.wrapT = THREE.RepeatWrapping;
                    map.repeat.set(repeat.x, repeat.y);
                }
                return map;
            }
            return new THREE.MeshStandardMaterial(Object.assign({ map: bake('color'), normalMap: bake('normal') }, materialParams));
        },
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
