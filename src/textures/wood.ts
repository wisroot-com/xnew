//----------------------------------------------------------------------------------------------------
// xtextures / Wood — procedural wood as a GLSL function of object-space position + a uniform schema.
// Ported from boytchev/tsl-textures "Wood". Host-agnostic: the runtime (canvas) and xthree (material)
// each supply `pos`; uniform names equal the schema keys (no prefix), colors are 0..1 RGB vec3.
//----------------------------------------------------------------------------------------------------

import { XTEX_NOISE } from './noise';
import type { TextureDef } from './runtime';

export const wood: TextureDef = {
    name: 'Wood',
    fn: 'xtexWood',
    glsl:
        XTEX_NOISE +
        `
uniform float scale, rings, lengths, angle, fibers, fibersDensity, seed;
uniform vec3 color, background;

vec3 xtexWood(vec3 position){
  float ang = radians(angle);
  float ca = cos(ang), sa = sin(ang);
  vec3 posLocal = vec3(
    position.x*ca - position.y*sa,
    position.x*sa + position.y*ca,
    position.z
  );

  // main ring pattern
  vec3 pos = posLocal * exp(scale - 3.0) * vec3(1.0/lengths, 4.0, 1.0/lengths) + seed;
  float k = (xtex_noise(pos) + 1.0) * 10.0 * rings;
  k = (cos(k + cos(k)) + 1.0) / 2.0;

  // fibers: 10 octaves of turbulence, high-frequency along y
  float kk = 0.0, sum = 0.0, power = 2.0;
  vec3 sc = exp(scale - 2.0) * vec3(1.0, fibersDensity, 1.0);
  for (int i = 0; i < 10; i++){
    kk += power * xtex_noise(posLocal * sc + seed);
    sum += power;
    sc *= 1.8;
    power *= 0.6;
  }
  kk = (sin(kk * 5.0 / sum * 10.0) + 1.0) / 2.0;

  return mix(color, background, mix(k, kk, fibers));
}
`,
    uniforms: {
        scale: { value: 2.5, min: 0, max: 6, step: 0.1 },
        rings: { value: 4.5, min: 0, max: 20, step: 0.1 },
        lengths: { value: 1, min: 0.1, max: 10, step: 0.1 },
        angle: { value: 0, min: 0, max: 360, step: 1 },
        fibers: { value: 0.3, min: 0, max: 1, step: 0.01 },
        fibersDensity: { value: 10, min: 0, max: 40, step: 0.5 },
        seed: { value: 0, min: 0, max: 100, step: 1 },
        color: { value: [0.8, 0.4, 0.0] },
        background: { value: [0.4, 0.1, 0.0] },
    },
};
