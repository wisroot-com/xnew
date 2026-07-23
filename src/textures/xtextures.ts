//----------------------------------------------------------------------------------------------------
// xtextures — procedural textures (shader-first). Each entry is a plain texture object: the GLSL
// source (injectable into adapters like xthree.material.shader()) plus the two usage flows — bake()
// to an ImageBitmap on a shared context, and renderer() for a caller-owned live-preview canvas.
//----------------------------------------------------------------------------------------------------

import {
    bakeTexture,
    createTextureRenderer,
    type BakeOptions,
    type RendererOptions,
    type TextureRenderer,
    type TextureSource,
} from './runtime';
import { wood } from './define/wood';
import { concrete } from './define/concrete';
import { tatami } from './define/tatami';

export interface Texture extends TextureSource {
    bake(options?: BakeOptions): ImageBitmap;
    renderer(canvas: HTMLCanvasElement, options?: RendererOptions): TextureRenderer;
}

// attach the usage flows to a source; schema / glsl consistency is asserted by the tests, not here
export function defineTexture(source: TextureSource): Texture {
    return {
        ...source,
        bake(options: BakeOptions = {}) {
            return bakeTexture(source, options);
        },
        renderer(canvas: HTMLCanvasElement, options: RendererOptions = {}) {
            return createTextureRenderer(canvas, source, options);
        },
    };
}

export const xtextures = {
    wood: defineTexture(wood),
    concrete: defineTexture(concrete),
    tatami: defineTexture(tatami),
};
