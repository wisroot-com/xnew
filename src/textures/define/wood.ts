//----------------------------------------------------------------------------------------------------
// xtextures / Wood — ranges + presets in TS; the GLSL body lives in glsl/wood.glsl (preview: preview/).
// Ported from boytchev/tsl-textures "Wood". glsl carries the body only — defineTexture prepends
// the noise prelude + generated uniform declarations; colors are 0..1 RGB vec3.
//----------------------------------------------------------------------------------------------------

import woodGlsl from '../glsl/wood.glsl';
import type { TexturePresets, TextureRange, TextureSource } from '../xtextures';

const ranges: Record<string, TextureRange> = {
    // common
    scale: { min: 0.1, max: 6 },
    angle: { min: 0, max: 360 },
    seed: { min: 0, max: 100 },
    // wood
    rings: { min: 0, max: 20 },
    lengths: { min: 0.1, max: 10 },
    fibers: { min: 0, max: 1 },
    fibersDensity: { min: 0, max: 40 },
};

const presets: TexturePresets = {
    standard: {
        // common
        scale: 1.65, angle: 0, seed: 0,
        color: [0.8, 0.4, 0.0],
        background: [0.4, 0.1, 0.0],
        // wood
        rings: 4.5, lengths: 1, fibers: 0.3, fibersDensity: 10,
    },
    // 檜風の淡い木目
    hinoki: {
        scale: 1.1, angle: 20, lengths: 10,
        color: [0.792, 0.714, 0.635],
        background: [0.78, 0.616, 0.557],
    },
};

export const wood: TextureSource = {
    name: 'wood',
    glsl: woodGlsl,
    ranges,
    presets,
};
