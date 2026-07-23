//----------------------------------------------------------------------------------------------------
// xtextures / Concrete — ranges + presets in TS; the GLSL bodies live in glsl/concrete.glsl.
// Two channels off one height field: color (tinted crevices/stains) + normal (perturbed relief).
// Ported from boytchev/tsl-textures "Concrete". glsl = noise + generated uniform decls + bodies.
//----------------------------------------------------------------------------------------------------

import noiseGlsl from '../glsl/noise.glsl';
import concreteGlsl from '../glsl/concrete.glsl';
import { uniformDeclarations, type TexturePresets, type TextureRange, type TextureSource } from '../runtime';

const ranges: Record<string, TextureRange> = {
    scale: { min: 0, max: 4 },
    density: { min: 0, max: 1 },
    bump: { min: -1, max: 1 }, // negative flips bumps into dents
    seed: { min: 0, max: 100 },
};

const presets: TexturePresets = {
    standard: {
        scale: 2, density: 0.5, bump: 0.5, seed: 0,
        color: [0.75, 0.75, 0.75],
        background: [0.55, 0.55, 0.55],
    },
};

export const concrete: TextureSource = {
    name: 'concrete',
    glsl: noiseGlsl + uniformDeclarations(presets.standard) + concreteGlsl,
    ranges,
    presets,
};
