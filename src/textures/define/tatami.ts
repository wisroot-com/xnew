//----------------------------------------------------------------------------------------------------
// xtextures / Tatami — ranges + presets in TS; the GLSL bodies live in glsl/tatami.glsl.
// One mat is a square cell centered on the origin, scale world units across (aspect, 2 = normal /
// 1 = hanjo, only scales the pattern), so a scale-sized quad in object space carries exactly one mat.
//----------------------------------------------------------------------------------------------------

import tatamiGlsl from '../glsl/tatami.glsl';
import type { TexturePresets, TextureRange, TextureSource } from '../xtextures';

const ranges: Record<string, TextureRange> = {
    // common
    scale: { min: 0.1, max: 4 },
    bump: { min: 0, max: 1 },
    seed: { min: 0, max: 100 },
    // tatami
    aspect: { min: 1, max: 2 },
    weave: { min: 8, max: 60 },
    heri: { min: 0, max: 0.2 },
};

const presets: TexturePresets = {
    standard: {
        // common — scale is the mat's short side in world units (a real mat is 0.88m); the viewers size their window from it
        scale: 1, bump: 0.2, seed: 0,
        color: [0.72, 0.71, 0.42],
        background: [0.66, 0.68, 0.38],
        // tatami
        aspect: 2, weave: 30, heri: 0.04,
        border: [0.23, 0.21, 0.14],
    },
    // 半畳: the square mat a 4.5-mat room puts at its center
    hanjo: {
        aspect: 1,
    },
};

export const tatami: TextureSource = {
    name: 'tatami',
    glsl: tatamiGlsl,
    ranges,
    presets,
};
