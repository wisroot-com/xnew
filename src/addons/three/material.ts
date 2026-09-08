//----------------------------------------------------------------------------------------------------
// material — build a three material from an xtextures texture object, in the three ways compared in
// docs/xtextures-three-materials.md. One entry point: material(texture, options), where options.type
// picks the path ('bake' when omitted, the right answer for most of a scene) and the rest of options
// configures it. The GLSL lives in ./glsl/*.glsl; resolveGlsl() splices the texture's own source and
// entry name in, so every texture-specific name goes through one place.
//----------------------------------------------------------------------------------------------------

import * as THREE from 'three';
import type { Texture, TexturePreset } from '../../textures/xtextures';
import frameGlsl from './glsl/frame.glsl';
import shaderVertexGlsl from './glsl/shader-vertex.glsl';
import shaderFragmentGlsl from './glsl/shader-fragment.glsl';

//----------------------------------------------------------------------------------------------------
// options — one interface per type, discriminated by type; params (texture parameters) is the only
// key all three share
//----------------------------------------------------------------------------------------------------

export type MaterialType = 'shader' | 'bake' | 'inject';

// 'shader': a self-contained ShaderMaterial with a material-local fixed light — scene lights /
// shadows do NOT apply, so nothing but the texture parameters is configurable
export interface ShaderMaterialOptions {
    type: 'shader';
    params?: TexturePreset;
}

// 'bake' (the default): the four bake keys reach texture.bake(), repeat wraps the maps it produces;
// every other key is handed to MeshStandardMaterial verbatim
export interface BakeMaterialOptions extends THREE.MeshStandardMaterialParameters {
    type?: 'bake';
    params?: TexturePreset;
    size?: { width: number, height: number };
    worldSize?: number;
    tile?: boolean;
    repeat?: { x: number, y: number };
}

// 'inject': no bake keys — the glsl is evaluated per-fragment; every other key goes to MeshStandardMaterial
export interface InjectMaterialOptions extends THREE.MeshStandardMaterialParameters {
    type: 'inject';
    params?: TexturePreset;
}

export type MaterialOptions = ShaderMaterialOptions | BakeMaterialOptions | InjectMaterialOptions;

// the inject path carries uniforms like a ShaderMaterial does — the bake path has them burned into its maps
export type InjectMaterial = THREE.MeshStandardMaterial & { uniforms: Record<string, THREE.IUniform> };

//----------------------------------------------------------------------------------------------------
// material — the public surface; options.type picks one of the three paths below ('bake' by default)
//----------------------------------------------------------------------------------------------------

export function material(texture: Texture, options: ShaderMaterialOptions): THREE.ShaderMaterial;
export function material(texture: Texture, options: InjectMaterialOptions): InjectMaterial;
export function material(texture: Texture, options?: BakeMaterialOptions): THREE.MeshStandardMaterial;
export function material(texture: Texture, options: MaterialOptions = {}): THREE.Material {
    const type = options.type ?? 'bake';
    if (type === 'shader') {
        const { params = {} } = options as ShaderMaterialOptions;
        return shaderMaterial(texture, params);
    } else if (type === 'bake') {
        const { type: _, params = {}, size, worldSize, tile, repeat, ...materialParams } = options as BakeMaterialOptions;
        return bakeMaterial(texture, { params, size, worldSize, tile, repeat }, materialParams);
    } else if (type === 'inject') {
        const { type: _, params = {}, ...materialParams } = options as InjectMaterialOptions;
        return injectMaterial(texture, params, materialParams);
    } else {
        throw new Error(`xthree.material: unknown type "${type}" (expected 'shader' | 'bake' | 'inject')`);
    }
}

//----------------------------------------------------------------------------------------------------
// glsl / uniform resolution — the one place a texture-specific name enters a shader
//----------------------------------------------------------------------------------------------------

// XTEX_ → the texture's entry prefix (xtexWood); //#include <frame> / <texture> → the matching glsl
function resolveGlsl(texture: Texture, source: string): string {
    return source
        .replace(/XTEX_/g, texture.entry)
        .replace('//#include <frame>', () => frameGlsl)
        .replace('//#include <texture>', () => texture.glsl);
}

// scalar → float uniform, [r, g, b] → vec3; the standard preset is the authority on the key set
function resolveUniforms(texture: Texture, params: TexturePreset): Record<string, THREE.IUniform> {
    const uniforms: Record<string, THREE.IUniform> = {};
    for (const name in texture.presets.standard) {
        const value = params[name] ?? texture.presets.standard[name];
        uniforms[name] = { value: Array.isArray(value) ? new THREE.Vector3(value[0], value[1], value[2]) : value };
    }
    return uniforms;
}

//----------------------------------------------------------------------------------------------------
// shader path — the texture's GLSL shades the mesh in object space with a material-local fixed light,
// so scene lights / shadows do NOT apply
//----------------------------------------------------------------------------------------------------

function shaderMaterial(texture: Texture, params: TexturePreset): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
        uniforms: resolveUniforms(texture, params),
        vertexShader: shaderVertexGlsl,
        fragmentShader: resolveGlsl(texture, shaderFragmentGlsl),
    });
}

//----------------------------------------------------------------------------------------------------
// bake path — color / normal become real maps, so scene lights / shadows / env maps / mipmaps all apply
//----------------------------------------------------------------------------------------------------

type BakeParams = Pick<BakeMaterialOptions, 'params' | 'size' | 'worldSize' | 'tile' | 'repeat'>;

function bakeMaterial(texture: Texture, bakeParams: BakeParams, materialParams: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
    const { params, size, worldSize, tile, repeat } = bakeParams;

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
}

//----------------------------------------------------------------------------------------------------
// inject path — the patches spliced into three's standard shader, one const per target chunk
//----------------------------------------------------------------------------------------------------

// object-space position / normal, carried from the vertex stage down to the fragment stage
const INJECT_VERTEX_VARYINGS = `
varying vec3 vXtexPos;
varying vec3 vXtexNormal;`;

const INJECT_VERTEX_ASSIGN = `
vXtexPos = position;
vXtexNormal = normal;`;

// normalMatrix is only declared in three's vertex prefix, but the renderer uploads program uniforms by name, so a fragment-side declaration receives the same per-object value
const INJECT_FRAGMENT_DECLS = `
uniform mat3 normalMatrix;
varying vec3 vXtexPos;
varying vec3 vXtexNormal;
vec3 xtexSrgbToLinear(vec3 c){ return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c)); }
//#include <frame>
//#include <texture>`;

// preset colors are authored in display (sRGB) space like a baked map, so decode to linear for lighting
const INJECT_FRAGMENT_ALBEDO = `
diffuseColor.rgb = xtexSrgbToLinear(XTEX_Color(vXtexPos));`;

// replaces its chunk outright: the perturbed object-space normal goes to view space via normalMatrix (faceDirection for double-sided materials)
const INJECT_FRAGMENT_NORMAL = `{
vec3 xtexN = normalize(vXtexNormal);
normal = normalize(normalMatrix * XTEX_Normal(vXtexPos, xtexN, xtexTangent(xtexN))) * faceDirection;
}`;

// albedo / normal are computed per-fragment in object space (solid look, no UV, no bake) while the full
// PBR pipeline still applies. Depends on three's internal chunk names — the one three-version-sensitive
// spot in this addon.
function injectMaterial(texture: Texture, params: TexturePreset, materialParams: THREE.MeshStandardMaterialParameters): InjectMaterial {
    const uniforms = resolveUniforms(texture, params);

    const standardMaterial = new THREE.MeshStandardMaterial(materialParams) as InjectMaterial;
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
    // three hashes onBeforeCompile by its source text, which is identical across textures — key the
    // program cache by texture instead, or two injected textures would share one compiled shader
    standardMaterial.customProgramCacheKey = () => `xtextures:${texture.name}`;
    // same live-params surface as ShaderMaterial: writing uniforms[name].value reaches the shader
    standardMaterial.uniforms = uniforms;
    return standardMaterial;
}
