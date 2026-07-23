//----------------------------------------------------------------------------------------------------
// xtextures / Tatami — ranges + presets in TS; the GLSL bodies live in glsl/tatami.glsl.
// A 2x1 mat is the base unit: heri cloth along the long edges, weave grooves along the long axis.
// glsl = noise + generated uniform decls + bodies; colors are 0..1 RGB vec3.
//----------------------------------------------------------------------------------------------------

import noiseGlsl from '../glsl/noise.glsl';
import tatamiGlsl from '../glsl/tatami.glsl';
import { uniformDeclarations, type TexturePresets, type TextureRange, type TextureSource } from '../runtime';

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
    glsl: noiseGlsl + uniformDeclarations(presets.standard) + tatamiGlsl,
    ranges,
    presets,
};
