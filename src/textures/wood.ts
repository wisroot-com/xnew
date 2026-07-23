//----------------------------------------------------------------------------------------------------
// xtextures / Wood — uniform schema in TS; the GLSL body lives in glsl/wood.glsl (preview: preview/).
// Ported from boytchev/tsl-textures "Wood". def.glsl = noise + generated uniform decls + body,
// so hosts (canvas runtime / xthree) inject one complete source; colors are 0..1 RGB vec3.
//----------------------------------------------------------------------------------------------------

import noiseGlsl from './glsl/noise.glsl';
import woodGlsl from './glsl/wood.glsl';
import { uniformDeclarations, type TextureSource, type TextureUniform } from './runtime';

const uniforms: Record<string, TextureUniform> = {
    scale: { value: 2.5, min: 0, max: 6, step: 0.1 },
    rings: { value: 4.5, min: 0, max: 20, step: 0.1 },
    lengths: { value: 1, min: 0.1, max: 10, step: 0.1 },
    angle: { value: 0, min: 0, max: 360, step: 1 },
    fibers: { value: 0.3, min: 0, max: 1, step: 0.01 },
    fibersDensity: { value: 10, min: 0, max: 40, step: 0.5 },
    seed: { value: 0, min: 0, max: 100, step: 1 },
    color: { value: [0.8, 0.4, 0.0] },
    background: { value: [0.4, 0.1, 0.0] },
};

export const wood: TextureSource = {
    name: 'wood',
    glsl: noiseGlsl + uniformDeclarations(uniforms) + woodGlsl,
    uniforms,
};
