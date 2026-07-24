//----------------------------------------------------------------------------------------------------
// xthree — Three.js integration: ties the Three scene graph to the xnew unit tree
// nest() makes a group Object3D and moves the current parent into it (stateful); add(obj) attaches a
// leaf without moving. detach never disposes GPU resources (may be shared) — release with dispose.
//----------------------------------------------------------------------------------------------------

import { xnew } from '@mulsense/xnew';
import * as THREE from 'three';

//----------------------------------------------------------------------------------------------------
// material — build a three material from an xtextures texture object ({ name, glsl, presets })
//----------------------------------------------------------------------------------------------------

const material = {
    // ShaderMaterial injection: the texture's GLSL shades the mesh in object space with a material-local fixed light — scene lights / shadows do NOT apply.
    shader(texture: any, params: Record<string, any>): THREE.ShaderMaterial {
        // channel entry-function names inside the glsl are derived from the texture name: "wood" → xtexWoodColor / xtexWoodNormal
        const entry = 'xtex' + texture.name.charAt(0).toUpperCase() + texture.name.slice(1);
        const uniforms: Record<string, { value: any }> = {};
        for (const name in texture.presets.standard) {
            const value = params[name] ?? texture.presets.standard[name];
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
    // PBR path: bake color / normal into a MeshStandardMaterial's map / normalMap, so scene lights / shadows / env maps apply; bake options split off, the rest goes to the material.
    // inject: true skips baking and patches the texture GLSL into the standard shader instead (infinite resolution, live params via material.uniforms) — see injectStandard.
    standard(texture: any, options: Record<string, any>): THREE.MeshStandardMaterial {
        const { params, size, worldSize, tile, repeat, inject, ...materialParams } = options;
        if (inject === true) {
            return injectStandard(texture, params ?? {}, materialParams);
        }

        function bake(channel: 'color' | 'normal'): THREE.CanvasTexture {
            const map = new THREE.CanvasTexture(texture.bake({ params, size, worldSize, tile, channel }));
            map.colorSpace = channel === 'color' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
            map.anisotropy = 8;
            if (repeat !== undefined) {
                map.wrapS = map.wrapT = THREE.RepeatWrapping;
                map.repeat.set(repeat.x, repeat.y);
            }
            return map;
        }

        return new THREE.MeshStandardMaterial({
            map: bake('color'),
            normalMap: bake('normal'),
            ...materialParams,
        });
    },
};

// onBeforeCompile injection: patch the texture GLSL into MeshStandardMaterial's generated shader, so
// albedo / normal are computed per-fragment in object space (solid look, no UV, no bake) while the
// full PBR pipeline (scene lights / shadows / env maps) still applies. Depends on three's internal
// chunk names (#include <common> / <begin_vertex> / <map_fragment> / <normal_fragment_maps>) — the
// one three-version-sensitive spot in this addon.
function injectStandard(texture: any, params: Record<string, any>, materialParams: Record<string, any>): THREE.MeshStandardMaterial {
    const entry = 'xtex' + texture.name.charAt(0).toUpperCase() + texture.name.slice(1);
    const uniforms: Record<string, { value: any }> = {};
    for (const name in texture.presets.standard) {
        const value = params[name] ?? texture.presets.standard[name];
        uniforms[name] = { value: Array.isArray(value) ? new THREE.Vector3(value[0], value[1], value[2]) : value };
    }

    const material = new THREE.MeshStandardMaterial(materialParams);
    material.onBeforeCompile = (shader: any) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', `#include <common>
varying vec3 vXtexPos;
varying vec3 vXtexNormal;`)
            .replace('#include <begin_vertex>', `#include <begin_vertex>
vXtexPos = position;
vXtexNormal = normal;`);
        shader.fragmentShader = shader.fragmentShader
            // normalMatrix is only declared in three's vertex prefix, but the renderer uploads program
            // uniforms by name, so a fragment-side declaration receives the same per-object value
            .replace('#include <common>', `#include <common>
uniform mat3 normalMatrix;
varying vec3 vXtexPos;
varying vec3 vXtexNormal;
vec3 xtexSrgbToLinear(vec3 c){ return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c)); }
${texture.glsl}`)
            // preset colors are authored in display (sRGB) space like a baked map, so decode to linear for lighting
            .replace('#include <map_fragment>', `#include <map_fragment>
diffuseColor.rgb = xtexSrgbToLinear(${entry}Color(vXtexPos));`)
            .replace('#include <normal_fragment_maps>', `{
vec3 xtexN = normalize(vXtexNormal);
vec3 xtexT = normalize(abs(xtexN.y) < 0.99 ? cross(vec3(0.0, 1.0, 0.0), xtexN) : cross(vec3(1.0, 0.0, 0.0), xtexN));
normal = normalize(normalMatrix * ${entry}Normal(vXtexPos, xtexN, xtexT)) * faceDirection;
}`);
    };
    // three hashes onBeforeCompile by its source text, which is identical across textures — key the
    // program cache by texture instead, or two injected textures would share one compiled shader
    material.customProgramCacheKey = () => `xtextures:${texture.name}`;
    // same live-params surface as ShaderMaterial: writing material.uniforms[name].value reaches the shader
    (material as any).uniforms = uniforms;
    return material;
}

export const xthree = {
    initialize (
        { canvas, camera = null }:
        { canvas: HTMLCanvasElement, camera?: THREE.Camera | null }
    ) {
        return xnew.promise(xnew(Root, { canvas, camera }));
    },
    // create a group Object3D and move the current parent into it (stateful); options set its transform only — never an existing object.
    nest(
        options?: {
            position?: { x: number, y: number, z?: number },
            scale?: number | { x: number, y: number, z?: number },
            rotation?: { x: number, y: number, z?: number },
        }
    ): THREE.Group {
        const object = new THREE.Group();
        if (options !== undefined) {
            const { position, scale, rotation } = options;
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
    // detach and release all GPU resources; assumes they are not shared elsewhere
    dispose(object: any) {
        object.parent?.remove(object);
        disposeObject(object);
    },
    // build a three material from an xtextures texture object (see the material block below)
    material,
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

function Root(unit: xnew.Unit, { canvas, camera }: any) {
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
    renderer.setClearColor(0x000000, 0);

    camera = camera ?? new THREE.PerspectiveCamera(45, renderer.domElement.width / renderer.domElement.height);
    const scene = new THREE.Scene();

    // release the renderer + WebGL context on tree teardown
    unit.on('finalize', () => {
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

// traverse the object and dispose geometry / material / texture
function disposeObject(object: any): void {
    object.traverse((obj: any) => {
        if (!obj.isMesh) return;
        obj.geometry?.dispose();
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const material of materials) {
            if (!material) continue;
            // dispose textures referenced by the material
            for (const key in material) {
                const value = material[key];
                if (value && value.isTexture) value.dispose();
            }
            material.dispose();
        }
    });
}

// shared by nest / add: attach to the current Three parent (root scene or nearest enclosing nest), detach (never dispose) on finalize
function attach(unit: xnew.Unit, object: any): void {
    const root = xnew.context(Root);
    const parent = xnew.context(Nest)?.threeObject ?? root.scene;

    parent.add(object);
    unit.on('finalize', () => {
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
