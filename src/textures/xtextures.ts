//----------------------------------------------------------------------------------------------------
// xtextures — procedural textures (shader-first). Each entry is a plain texture object: the GLSL def
// (injectable into adapters like xthree.texture()) plus the three usage flows — bake() to an
// ImageBitmap on a shared context, and renderer() for a caller-owned live-preview canvas.
//----------------------------------------------------------------------------------------------------

import {
    bakeTexture,
    createTextureRenderer,
    type BakeOptions,
    type RendererOptions,
    type TextureDef,
    type TextureRenderer,
} from './runtime';
import { wood } from './wood';
import { concrete } from './concrete';
import { tatami } from './tatami';

export interface Texture extends TextureDef {
    bake(options?: BakeOptions): ImageBitmap;
    renderer(canvas: HTMLCanvasElement, options?: RendererOptions): TextureRenderer;
}

function defineTexture(def: TextureDef): Texture {
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
