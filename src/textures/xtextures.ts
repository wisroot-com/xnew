//----------------------------------------------------------------------------------------------------
// xtextures — procedural textures (shader-first). Each entry is a plain texture object: the GLSL def
// (injectable into adapters like xthree.material.shader()) plus the three usage flows — bake() to an
// ImageBitmap on a shared context, and renderer() for a caller-owned live-preview canvas.
//----------------------------------------------------------------------------------------------------

import {
    bakeTexture,
    createTextureRenderer,
    type BakeOptions,
    type RendererOptions,
    type TextureDef,
    type TextureRenderer,
    type TextureSource,
} from './runtime';
import { wood } from './wood';
import { concrete } from './concrete';
import { tatami } from './tatami';

export interface Texture extends TextureDef {
    bake(options?: BakeOptions): ImageBitmap;
    renderer(canvas: HTMLCanvasElement, options?: RendererOptions): TextureRenderer;
}

// derive the channel entry-function names (`xtex<Name>Color` / `xtex<Name>Normal`) from the source
// name and verify they exist in the glsl, so a mismatch fails here — not at shader compile time
export function defineTexture(source: TextureSource): Texture {
    if (/^[a-z][A-Za-z0-9]*$/.test(source.name) === false) {
        throw new Error(`xtextures: texture name "${source.name}" must be a lowercase-led identifier`);
    }
    const entry = 'xtex' + source.name.charAt(0).toUpperCase() + source.name.slice(1);
    const def: TextureDef = { ...source, color: `${entry}Color`, normal: `${entry}Normal` };
    for (const channel of ['color', 'normal'] as const) {
        if (source.glsl.includes(`vec3 ${def[channel]}(`) === false) {
            throw new Error(`xtextures: texture "${source.name}" glsl does not define vec3 ${def[channel]}(...)`);
        }
    }
    return {
        ...def,
        bake(options: BakeOptions = {}) {
            return bakeTexture(def, options);
        },
        renderer(canvas: HTMLCanvasElement, options: RendererOptions = {}) {
            return createTextureRenderer(canvas, def, options);
        },
    };
}

export const xtextures = {
    wood: defineTexture(wood),
    concrete: defineTexture(concrete),
    tatami: defineTexture(tatami),
};
