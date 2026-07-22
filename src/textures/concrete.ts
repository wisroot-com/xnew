//----------------------------------------------------------------------------------------------------
// xtextures / Concrete — uniform schema in TS; the GLSL body lives in glsl/concrete.glsl (kind: 'normal').
// Ported from boytchev/tsl-textures "Concrete". def.glsl = noise + generated uniform decls + body,
// so hosts (canvas runtime / xthree) inject one complete source.
//----------------------------------------------------------------------------------------------------

import noiseGlsl from './glsl/noise.glsl';
import concreteGlsl from './glsl/concrete.glsl';
import { uniformDeclarations, type TextureDef, type TextureUniform } from './runtime';

const uniforms: Record<string, TextureUniform> = {
    scale: { value: 2, min: 0, max: 4, step: 0.1 },
    density: { value: 0.5, min: 0, max: 1, step: 0.01 },
    bump: { value: 0.5, min: -1, max: 1, step: 0.01 }, // negative flips bumps into dents
    seed: { value: 0, min: 0, max: 100, step: 1 },
};

export const concrete: TextureDef = {
    name: 'Concrete',
    fn: 'xtexConcrete',
    kind: 'normal',
    glsl: noiseGlsl + uniformDeclarations(uniforms) + concreteGlsl,
    uniforms,
};
