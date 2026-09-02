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

const material = {
    shader(texture, params) {
        var _a;
        const entry = 'xtex' + texture.name.charAt(0).toUpperCase() + texture.name.slice(1);
        const uniforms = {};
        for (const name in texture.presets.standard) {
            const value = (_a = params[name]) !== null && _a !== void 0 ? _a : texture.presets.standard[name];
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
            ${texture.glsl}
            void main() {
                vec3 nrm = normalize(vXtexNormal);
                vec3 tng = normalize(abs(nrm.y) < 0.99 ? cross(vec3(0.0, 1.0, 0.0), nrm) : cross(vec3(1.0, 0.0, 0.0), nrm));
                vec3 n = ${entry}Normal(vXtexPos, nrm, tng);
                vec3 albedo = ${entry}Color(vXtexPos);
                float diff = 0.55 + 0.45 * max(dot(n, normalize(vXtexLight)), 0.0);
                gl_FragColor = vec4(albedo * diff, 1.0);
            }
        `;
        return new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader });
    },
    standard(texture, options) {
        const { params, size, worldSize, tile, repeat, inject } = options, materialParams = __rest(options, ["params", "size", "worldSize", "tile", "repeat", "inject"]);
        if (inject === true) {
            return injectStandard(texture, params !== null && params !== void 0 ? params : {}, materialParams);
        }
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
};
function injectStandard(texture, params, materialParams) {
    var _a;
    const entry = 'xtex' + texture.name.charAt(0).toUpperCase() + texture.name.slice(1);
    const uniforms = {};
    for (const name in texture.presets.standard) {
        const value = (_a = params[name]) !== null && _a !== void 0 ? _a : texture.presets.standard[name];
        uniforms[name] = { value: Array.isArray(value) ? new THREE.Vector3(value[0], value[1], value[2]) : value };
    }
    const material = new THREE.MeshStandardMaterial(materialParams);
    material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', `#include <common>
varying vec3 vXtexPos;
varying vec3 vXtexNormal;`)
            .replace('#include <begin_vertex>', `#include <begin_vertex>
vXtexPos = position;
vXtexNormal = normal;`);
        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', `#include <common>
uniform mat3 normalMatrix;
varying vec3 vXtexPos;
varying vec3 vXtexNormal;
vec3 xtexSrgbToLinear(vec3 c){ return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c)); }
${texture.glsl}`)
            .replace('#include <map_fragment>', `#include <map_fragment>
diffuseColor.rgb = xtexSrgbToLinear(${entry}Color(vXtexPos));`)
            .replace('#include <normal_fragment_maps>', `{
vec3 xtexN = normalize(vXtexNormal);
vec3 xtexT = normalize(abs(xtexN.y) < 0.99 ? cross(vec3(0.0, 1.0, 0.0), xtexN) : cross(vec3(1.0, 0.0, 0.0), xtexN));
normal = normalize(normalMatrix * ${entry}Normal(vXtexPos, xtexN, xtexT)) * faceDirection;
}`);
    };
    material.customProgramCacheKey = () => `xtextures:${texture.name}`;
    material.uniforms = uniforms;
    return material;
}
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
    material,
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
