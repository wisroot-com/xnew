//----------------------------------------------------------------------------------------------------
// xtextures / Wood — ranges + presets in TS; the GLSL body lives in glsl/wood.glsl (preview: preview/).
// Ported from boytchev/tsl-textures "Wood". glsl = noise + generated uniform decls + body,
// so hosts (canvas runtime / xthree) inject one complete source; colors are 0..1 RGB vec3.
//----------------------------------------------------------------------------------------------------

import noiseGlsl from '../glsl/noise.glsl';
import woodGlsl from '../glsl/wood.glsl';
import { uniformDeclarations, type TexturePresets, type TextureRange, type TextureSource } from '../runtime';

const ranges: Record<string, TextureRange> = {
    scale: { min: 0, max: 6 },
    rings: { min: 0, max: 20 },
    lengths: { min: 0.1, max: 10 },
    angle: { min: 0, max: 360 },
    fibers: { min: 0, max: 1 },
    fibersDensity: { min: 0, max: 40 },
    seed: { min: 0, max: 100 },
};

const presets: TexturePresets = {
    standard: {
        scale: 2.5, rings: 4.5, lengths: 1, angle: 0, fibers: 0.3, fibersDensity: 10, seed: 0,
        color: [0.8, 0.4, 0.0],
        background: [0.4, 0.1, 0.0],
    },
    // 檜風の淡い木目
    hinoki: {
        scale: 2.9, lengths: 10, angle: 20,
        color: [0.792, 0.714, 0.635],
        background: [0.78, 0.616, 0.557],
    },
};

export const wood: TextureSource = {
    name: 'wood',
    glsl: noiseGlsl + uniformDeclarations(presets.standard) + woodGlsl,
    ranges,
    presets,
};
