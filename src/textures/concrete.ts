//----------------------------------------------------------------------------------------------------
// xtextures / Concrete — uniform schema in TS; the GLSL bodies live in glsl/concrete.glsl.
// Two channels off one height field: color (tinted crevices/stains) + normal (perturbed relief).
// Ported from boytchev/tsl-textures "Concrete". def.glsl = noise + generated uniform decls + bodies.
//----------------------------------------------------------------------------------------------------

import noiseGlsl from './glsl/noise.glsl';
import concreteGlsl from './glsl/concrete.glsl';
import { uniformDeclarations, type TextureDef, type TextureUniform } from './runtime';

const uniforms: Record<string, TextureUniform> = {
    scale: { value: 2, min: 0, max: 4, step: 0.1 },
    density: { value: 0.5, min: 0, max: 1, step: 0.01 },
    bump: { value: 0.5, min: -1, max: 1, step: 0.01 }, // negative flips bumps into dents
    seed: { value: 0, min: 0, max: 100, step: 1 },
    color: { value: [0.75, 0.75, 0.75] },
    background: { value: [0.55, 0.55, 0.55] },
};

export const concrete: TextureDef = {
    name: 'Concrete',
    color: 'xtexConcreteColor',
    normal: 'xtexConcreteNormal',
    glsl: noiseGlsl + uniformDeclarations(uniforms) + concreteGlsl,
    uniforms,
};
