//----------------------------------------------------------------------------------------------------
// xtextures / Carpet — ranges + presets in TS; the GLSL bodies live in glsl/carpet.glsl.
// scale sizes one cell in world units and density the fibers inside it, so the two together set how
// coarse the pile looks; angle aims the nap, swirl how far the fiber layers lean away from it.
//----------------------------------------------------------------------------------------------------

import carpetGlsl from '../glsl/carpet.glsl';
import type { TexturePresets, TextureRange, TextureSource } from '../xtextures';

const ranges: Record<string, TextureRange> = {
    // common
    scale: { min: 0.1, max: 2 },
    angle: { min: 0, max: 360 },
    bump: { min: 0, max: 1 },
    seed: { min: 0, max: 100 },
    // carpet
    fluff: { min: 0, max: 1 },
    density: { min: 5, max: 60 },
    swirl: { min: 0, max: 1 },
    shade: { min: 0, max: 1 },
};

const presets: TexturePresets = {
    standard: {
        // common — angle aims the nap (毛並み)
        scale: 1, angle: 0, bump: 0.6, seed: 0,
        color: [1.0, 1.0, 1.0],
        background: [1.0, 1.0, 1.0],
        // carpet — fluff: 0 = sparse crisp hairs, 1 = dense soft plush; shade is the depth between them
        fluff: 0.5, density: 25, swirl: 0.5, shade: 0.1,
    },
    // 起毛の浅い、ごく柔らかいプラッシュ
    plush: {
        bump: 0.4, fluff: 0.85, shade: 0.25,
    },
    // 短毛のグリーンカーペット
    moss: {
        fluff: 0.7, density: 40, swirl: 0.3, shade: 0.5,
        color: [0.45, 0.6, 0.38],
        background: [0.24, 0.35, 0.2],
    },
};

export const carpet: TextureSource = {
    name: 'carpet',
    glsl: carpetGlsl,
    ranges,
    presets,
};
