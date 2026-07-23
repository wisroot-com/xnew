//----------------------------------------------------------------------------------------------------
// xtextures / Tatami — ranges + presets in TS; the GLSL bodies live in glsl/tatami.glsl.
// A 2x1 mat is the base unit: heri cloth along the long edges, weave grooves along the long axis.
// glsl carries the bodies only (assembled by defineTexture); colors are 0..1 RGB vec3.
//----------------------------------------------------------------------------------------------------

import tatamiGlsl from '../glsl/tatami.glsl';
import type { TexturePresets, TextureRange, TextureSource } from '../xtextures';

const ranges: Record<string, TextureRange> = {
    scale: { min: 0, max: 4 },
    weave: { min: 8, max: 60 },
    heri: { min: 0, max: 0.2 },
    bump: { min: 0, max: 1 },
    seed: { min: 0, max: 100 },
};

const presets: TexturePresets = {
    standard: {
        scale: 2, weave: 30, heri: 0.04, bump: 0.5, seed: 0,
        color: [0.72, 0.71, 0.42],
        background: [0.66, 0.68, 0.38],
        border: [0.23, 0.21, 0.14],
    },
};

export const tatami: TextureSource = {
    name: 'tatami',
    glsl: tatamiGlsl,
    ranges,
    presets,
};
