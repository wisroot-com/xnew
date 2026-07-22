//----------------------------------------------------------------------------------------------------
// xtextures / Tatami — uniform schema in TS; the GLSL bodies live in glsl/tatami.glsl.
// A 2x1 mat is the base unit: heri cloth along the long edges, weave grooves along the long axis.
// def.glsl = noise + generated uniform decls + bodies; colors are 0..1 RGB vec3.
//----------------------------------------------------------------------------------------------------

import noiseGlsl from './glsl/noise.glsl';
import tatamiGlsl from './glsl/tatami.glsl';
import { uniformDeclarations, type TextureDef, type TextureUniform } from './runtime';

const uniforms: Record<string, TextureUniform> = {
    scale: { value: 2, min: 0, max: 4, step: 0.1 },
    weave: { value: 30, min: 8, max: 60, step: 1 },
    heri: { value: 0.04, min: 0, max: 0.2, step: 0.005 },
    bump: { value: 0.5, min: 0, max: 1, step: 0.01 },
    seed: { value: 0, min: 0, max: 100, step: 1 },
    color: { value: [0.72, 0.71, 0.42] },
    background: { value: [0.66, 0.68, 0.38] },
    border: { value: [0.23, 0.21, 0.14] },
};

export const tatami: TextureDef = {
    name: 'Tatami',
    color: 'xtexTatamiColor',
    normal: 'xtexTatamiNormal',
    glsl: noiseGlsl + uniformDeclarations(uniforms) + tatamiGlsl,
    uniforms,
};
