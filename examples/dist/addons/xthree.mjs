import { xnew, xtextures } from '@mulsense/xnew';
import * as THREE from 'three';

function initialize({ canvas, camera = null }) {
    return xnew.promise(xnew(Root, { canvas, camera }));
}
function nest(options) {
    const object = new THREE.Group();
    if (options !== undefined) {
        applyTransform(object, options);
    }
    xnew(Nest, { object });
    xnew.extend(() => {
        return {
            get threeObject() { return object; }
        };
    });
    return object;
}
function add(object) {
    xnew(Add, { object });
    return object;
}
function applyTransform(object, { position, scale, rotation }) {
    var _a, _b, _c;
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

var frameGlsl = "//----------------------------------------------------------------------------------------------------\n// xtexTangent — a stable tangent for object-space texturing: any vector perpendicular to the normal.\n// Both material paths must build the frame the same way, or the same texture shades differently in each.\n//----------------------------------------------------------------------------------------------------\n\nvec3 xtexTangent(vec3 n) {\n  return normalize(abs(n.y) < 0.99 ? cross(vec3(0.0, 1.0, 0.0), n) : cross(vec3(1.0, 0.0, 0.0), n));\n}\n";

var shaderVertexGlsl = "//----------------------------------------------------------------------------------------------------\n// xthree shader material — vertex stage: hand the object-space position / normal to the fragment stage.\n// This path has no scene lights, so it also carries one fixed light direction, rotated into object space.\n//----------------------------------------------------------------------------------------------------\n\nvarying vec3 vXtexPos;\nvarying vec3 vXtexNormal;\nvarying vec3 vXtexLight;\n\nvoid main() {\n  vXtexPos = position;\n  vXtexNormal = normal;\n\n  // rotate the view-space light into object space: transpose(mat3(mv)) * light\n  mat3 mv = mat3(modelViewMatrix);\n  vec3 light = normalize(vec3(0.4, 0.7, 0.6));\n  vXtexLight = vec3(dot(mv[0], light), dot(mv[1], light), dot(mv[2], light));\n\n  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n}\n";

var shaderFragmentGlsl = "//----------------------------------------------------------------------------------------------------\n// xthree shader material — fragment stage: shade in object space with the material-local light.\n// The texture's own glsl and its entry-function prefix are spliced in by resolveGlsl (material.ts).\n//----------------------------------------------------------------------------------------------------\n\nvarying vec3 vXtexPos;\nvarying vec3 vXtexNormal;\nvarying vec3 vXtexLight;\n\n//#include <frame>\n//#include <texture>\n\nvoid main() {\n  vec3 nrm = normalize(vXtexNormal);\n  vec3 n = XTEX_Normal(vXtexPos, nrm, xtexTangent(nrm));\n  vec3 albedo = XTEX_Color(vXtexPos);\n  float diff = 0.55 + 0.45 * max(dot(n, normalize(vXtexLight)), 0.0);\n  gl_FragColor = vec4(albedo * diff, 1.0);\n}\n";

function resolveGlsl(texture, source) {
    return source
        .replace(/XTEX_/g, texture.entry)
        .replace('//#include <frame>', () => frameGlsl)
        .replace('//#include <texture>', () => texture.glsl);
}
function resolveUniforms(texture, params) {
    var _a;
    const uniforms = {};
    for (const name in texture.presets.standard) {
        const value = (_a = params[name]) !== null && _a !== void 0 ? _a : texture.presets.standard[name];
        uniforms[name] = { value: Array.isArray(value) ? new THREE.Vector3(value[0], value[1], value[2]) : value };
    }
    return uniforms;
}
const material = { shader, standard };
function shader(texture, params = {}) {
    return new THREE.ShaderMaterial({
        uniforms: resolveUniforms(texture, params),
        vertexShader: shaderVertexGlsl,
        fragmentShader: resolveGlsl(texture, shaderFragmentGlsl),
    });
}
function standard(texture, options = {}) {
    const { params = {}, size, worldSize, tile, repeat, inject } = options, materialParams = __rest(options, ["params", "size", "worldSize", "tile", "repeat", "inject"]);
    if (inject === true) {
        return injectStandard(texture, params, materialParams);
    }
    else {
        return bakeStandard(texture, { params, size, worldSize, tile, repeat }, materialParams);
    }
}
function bakeStandard(texture, bakeOptions, materialParams) {
    const { params, size, worldSize, tile, repeat } = bakeOptions;
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
}
const INJECT_VERTEX_VARYINGS = `
varying vec3 vXtexPos;
varying vec3 vXtexNormal;`;
const INJECT_VERTEX_ASSIGN = `
vXtexPos = position;
vXtexNormal = normal;`;
const INJECT_FRAGMENT_DECLS = `
uniform mat3 normalMatrix;
varying vec3 vXtexPos;
varying vec3 vXtexNormal;
vec3 xtexSrgbToLinear(vec3 c){ return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c)); }
//#include <frame>
//#include <texture>`;
const INJECT_FRAGMENT_ALBEDO = `
diffuseColor.rgb = xtexSrgbToLinear(XTEX_Color(vXtexPos));`;
const INJECT_FRAGMENT_NORMAL = `{
vec3 xtexN = normalize(vXtexNormal);
normal = normalize(normalMatrix * XTEX_Normal(vXtexPos, xtexN, xtexTangent(xtexN))) * faceDirection;
}`;
function injectStandard(texture, params, materialParams) {
    const uniforms = resolveUniforms(texture, params);
    const standardMaterial = new THREE.MeshStandardMaterial(materialParams);
    standardMaterial.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>' + INJECT_VERTEX_VARYINGS)
            .replace('#include <begin_vertex>', '#include <begin_vertex>' + INJECT_VERTEX_ASSIGN);
        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', '#include <common>' + resolveGlsl(texture, INJECT_FRAGMENT_DECLS))
            .replace('#include <map_fragment>', '#include <map_fragment>' + resolveGlsl(texture, INJECT_FRAGMENT_ALBEDO))
            .replace('#include <normal_fragment_maps>', resolveGlsl(texture, INJECT_FRAGMENT_NORMAL));
    };
    standardMaterial.customProgramCacheKey = () => `xtextures:${texture.name}`;
    standardMaterial.uniforms = uniforms;
    return standardMaterial;
}

function Chabudai(unit, { radius = 0.7, thickness = 0.07, height = 0.25, legs = 4, legRadius = 0.03, texture = {}, position, rotation, scale, } = {}) {
    nest({ position, rotation, scale });
    const wood = Object.assign(Object.assign({}, xtextures.wood.presets.hinoki), texture);
    const edge = thickness * 0.35;
    const capRadius = radius - edge;
    const side = add(new THREE.Mesh(makeSideGeometry(radius, thickness, edge), standard(xtextures.wood, {
        size: { width: 512, height: 64 }, worldSize: 1.5, params: wood,
        tile: true, repeat: { x: 3, y: 1 }, roughness: 0.65,
    })));
    side.position.y = height;
    side.castShadow = true;
    side.receiveShadow = true;
    const top = add(new THREE.Mesh(new THREE.CircleGeometry(capRadius, 64), standard(xtextures.wood, {
        size: { width: 512, height: 512 }, worldSize: 1.5, params: wood, roughness: 0.55,
    })));
    top.rotation.x = -Math.PI / 2;
    top.position.y = height + thickness / 2;
    top.castShadow = true;
    top.receiveShadow = true;
    const bottom = add(new THREE.Mesh(new THREE.CircleGeometry(capRadius, 64), new THREE.MeshStandardMaterial({ color: 0xcab6a2, roughness: 0.7 })));
    bottom.rotation.x = Math.PI / 2;
    bottom.position.y = height - thickness / 2;
    bottom.castShadow = true;
    const legMaterial = standard(xtextures.wood, {
        size: { width: 128, height: 256 }, worldSize: 1, params: Object.assign(Object.assign({}, wood), { angle: wood.angle + 90 }), roughness: 0.6,
    });
    const legHeight = height - thickness / 2;
    for (let i = 0; i < legs; i++) {
        const angle = Math.PI / legs + i * 2 * Math.PI / legs;
        const leg = add(new THREE.Mesh(makeLegGeometry(legRadius, legRadius * 1.2, legHeight), legMaterial));
        const r = radius * 0.85;
        leg.position.set(Math.cos(angle) * r, legHeight / 2, Math.sin(angle) * r);
        leg.castShadow = true;
    }
}
function makeSideGeometry(radius, thickness, edge) {
    const capRadius = radius - edge;
    const profile = [];
    for (let i = 0; i <= 4; i++) {
        const t = -Math.PI / 2 + Math.PI / 2 * (i / 4);
        profile.push(new THREE.Vector2(capRadius + edge * Math.cos(t), -thickness / 2 + edge + edge * Math.sin(t)));
    }
    profile.push(new THREE.Vector2(radius, 0));
    for (let i = 0; i <= 4; i++) {
        const t = Math.PI / 2 * (i / 4);
        profile.push(new THREE.Vector2(capRadius + edge * Math.cos(t), thickness / 2 - edge + edge * Math.sin(t)));
    }
    return new THREE.LatheGeometry(profile, 64);
}
function makeLegGeometry(radiusTop, radiusBottom, height, segments = 8) {
    const chamfer = Math.min(radiusTop, radiusBottom) * 0.25;
    const half = height / 2;
    const profile = [new THREE.Vector2(0, -half), new THREE.Vector2(radiusBottom - chamfer, -half)];
    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        profile.push(new THREE.Vector2(radiusBottom + (radiusTop - radiusBottom) * t, -half + chamfer + (height - 2 * chamfer) * t));
    }
    profile.push(new THREE.Vector2(radiusTop - chamfer, half), new THREE.Vector2(0, half));
    return new THREE.LatheGeometry(profile, 16);
}

function Tatami(unit, { size = 1, grid = [2, 1], thickness = 0.06, texture = {}, position, rotation, scale, } = {}) {
    nest({ position, rotation, scale });
    const [cols, rows] = grid;
    const geometries = {};
    layout(cols, rows).forEach(({ x, z, aspect, turned }, index) => {
        var _a, _b;
        const geometry = (_a = geometries[aspect]) !== null && _a !== void 0 ? _a : (geometries[aspect] = makeGeometry(size, aspect, thickness));
        const mesh = add(new THREE.Mesh(geometry, standard(xtextures.tatami, {
            params: Object.assign(Object.assign({}, texture), { scale: size, aspect, seed: ((_b = texture.seed) !== null && _b !== void 0 ? _b : 0) + index * 13 }),
            worldSize: size,
            size: { width: Math.round(512 * aspect), height: 512 },
            roughness: 1,
        })));
        mesh.rotation.y = turned ? Math.PI / 2 : 0;
        mesh.position.set((x - cols / 2) * size, thickness / 2, (z - rows / 2) * size);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
    });
}
const OPTIONS = [
    { aspect: 2, turned: false },
    { aspect: 2, turned: true },
    { aspect: 1, turned: false },
];
const STEP_LIMIT = 20000;
function layout(cols, rows) {
    var _a, _b;
    const odd = (cols * rows) % 2 === 1;
    return (_b = (_a = solve(cols, rows, true)) !== null && _a !== void 0 ? _a : (odd ? solve(cols, rows, false) : null)) !== null && _b !== void 0 ? _b : straight(cols, rows);
}
function solve(cols, rows, centered) {
    const owner = new Int32Array(cols * rows).fill(-1);
    const placements = [];
    let halves = (cols * rows) % 2;
    let steps = 0;
    function put(x, z, aspect, turned) {
        for (let i = 0; i < aspect; i++) {
            owner[(z + (turned ? i : 0)) * cols + x + (turned ? 0 : i)] = placements.length;
        }
        placements.push({ x: x + (turned ? 0.5 : aspect / 2), z: z + (turned ? aspect / 2 : 0.5), aspect, turned });
    }
    function undo(x, z, aspect, turned) {
        for (let i = 0; i < aspect; i++) {
            owner[(z + (turned ? i : 0)) * cols + x + (turned ? 0 : i)] = -1;
        }
        placements.pop();
    }
    function free(x, z, aspect, turned) {
        const ex = x + (turned ? 0 : aspect - 1), ez = z + (turned ? aspect - 1 : 0);
        return ex < cols && ez < rows && owner[ez * cols + ex] === -1;
    }
    function corner(vx, vz) {
        let fine = true;
        if (vx > 0 && vz > 0 && vx < cols && vz < rows) {
            const ids = [owner[(vz - 1) * cols + vx - 1], owner[(vz - 1) * cols + vx], owner[vz * cols + vx - 1], owner[vz * cols + vx]];
            fine = ids.includes(-1) || new Set(ids).size < 4;
        }
        return fine;
    }
    function valid(x, z, aspect, turned) {
        let ok = true;
        for (let i = 0; i < aspect; i++) {
            const cx = x + (turned ? 0 : i), cz = z + (turned ? i : 0);
            ok = ok && corner(cx, cz) && corner(cx + 1, cz) && corner(cx, cz + 1) && corner(cx + 1, cz + 1);
        }
        return ok;
    }
    function fill(from) {
        let index = from;
        while (index < owner.length && owner[index] !== -1) {
            index++;
        }
        let done = index === owner.length;
        if (done === false && ++steps < STEP_LIMIT) {
            const x = index % cols, z = Math.floor(index / cols);
            for (const { aspect, turned } of OPTIONS) {
                if ((aspect === 2 || halves > 0) && free(x, z, aspect, turned)) {
                    halves -= aspect === 1 ? 1 : 0;
                    put(x, z, aspect, turned);
                    done = valid(x, z, aspect, turned) && fill(index + 1);
                    if (done === false) {
                        undo(x, z, aspect, turned);
                        halves += aspect === 1 ? 1 : 0;
                    }
                }
                if (done) {
                    break;
                }
            }
        }
        return done;
    }
    if (centered && halves === 1) {
        put((cols - 1) / 2, (rows - 1) / 2, 1, false);
        halves = 0;
    }
    return fill(0) ? placements : null;
}
function straight(cols, rows) {
    const placements = [];
    for (let z = 0; z < rows; z++) {
        for (let x = 0; x < cols; x++) {
            const aspect = x + 1 < cols ? 2 : 1;
            placements.push({ x: x + aspect / 2, z: z + 0.5, aspect, turned: false });
            x += aspect - 1;
        }
    }
    return placements;
}
function makeGeometry(size, aspect, thickness) {
    const chamfer = thickness * 0.15;
    const length = size * aspect;
    const hx = length / 2 - chamfer, hz = size / 2 - chamfer;
    const shape = new THREE.Shape()
        .moveTo(-hx, -hz).lineTo(hx, -hz).lineTo(hx, hz).lineTo(-hx, hz).lineTo(-hx, -hz);
    const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: thickness - 2 * chamfer,
        bevelEnabled: true, bevelSegments: 1, bevelOffset: 0,
        bevelSize: chamfer, bevelThickness: chamfer,
    });
    geometry.rotateX(-Math.PI / 2);
    geometry.center();
    applyUv(geometry, size, aspect, thickness);
    return geometry;
}
function applyUv(geometry, size, aspect, thickness) {
    const length = size * aspect;
    const position = geometry.attributes.position;
    const normal = geometry.attributes.normal;
    const uv = geometry.attributes.uv;
    for (let i = 0; i < position.count; i++) {
        const x = position.getX(i), z = position.getZ(i);
        const depth = 0.5 - position.getY(i) / thickness;
        if (Math.abs(normal.getY(i)) > 0.3) {
            uv.setXY(i, 0.5 + x / length, 0.5 - z / size);
        }
        else if (Math.abs(normal.getX(i)) > Math.abs(normal.getZ(i))) {
            const u = normal.getX(i) > 0 ? 0.97 - 0.02 * depth : 0.03 + 0.02 * depth;
            uv.setXY(i, u, 0.5 - z / size);
        }
        else {
            const v = normal.getZ(i) > 0 ? 0.006 + 0.01 * depth : 0.994 - 0.01 * depth;
            uv.setXY(i, 0.5 + x / length, v);
        }
    }
    uv.needsUpdate = true;
}

function Carpet(unit, { size = 12, tile = 2, fade, texture = {}, position, rotation, scale, } = {}) {
    nest({ position, rotation, scale });
    const mesh = add(new THREE.Mesh(new THREE.PlaneGeometry(size, size), standard(xtextures.carpet, Object.assign({ size: { width: 1024, height: 1024 }, worldSize: tile, params: texture, tile: true, repeat: { x: size / tile, y: size / tile }, roughness: 1 }, (fade === undefined ? {} : { transparent: true, alphaMap: makeFadeAlpha(size, fade) })))));
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
}
function makeFadeAlpha(size, { solid, clear }, resolution = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = resolution;
    const context = canvas.getContext('2d');
    const half = size / 2;
    const gradient = context.createRadialGradient(resolution / 2, resolution / 2, 0, resolution / 2, resolution / 2, resolution / 2);
    gradient.addColorStop(0, '#fff');
    gradient.addColorStop(Math.min(solid / half, 1), '#fff');
    gradient.addColorStop(Math.min(clear / half, 1), '#000');
    gradient.addColorStop(1, '#000');
    context.fillStyle = gradient;
    context.fillRect(0, 0, resolution, resolution);
    return new THREE.CanvasTexture(canvas);
}

const models = {
    Chabudai,
    Tatami,
    Carpet,
};

const xthree = {
    initialize,
    nest,
    add,
    material,
    models,
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

export { xthree };
