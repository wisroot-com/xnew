//----------------------------------------------------------------------------------------------------
// xtextures / Concrete — bumpy concrete surface as a perturbed NORMAL (kind: 'normal'), not a color.
// Ported from boytchev/tsl-textures "Concrete": noise is a height field; the normal is approximated
// from three surface points offset along tangent / bitangent (finite differences, EPS = 0.001).
//----------------------------------------------------------------------------------------------------

import { XTEX_NOISE } from './noise';
import type { TextureDef } from './runtime';

export const concrete: TextureDef = {
    name: 'Concrete',
    fn: 'xtexConcrete',
    kind: 'normal',
    glsl:
        XTEX_NOISE +
        `
uniform float scale, density, bump, seed;

vec3 xtex_concreteSurface(vec3 p, vec3 n, float d){
  float k = pow(abs(xtex_noise(p) * 0.5 + 0.5), d);
  return p + n * k;
}

vec3 xtexConcrete(vec3 position, vec3 normal, vec3 tangent){
  const float EPS = 0.001;
  vec3 seed3d = sin(vec3(1.0, 2.0, 3.0) * seed) * 100.0;

  vec3 xposition = position * exp(scale / 2.0 + 2.0) + seed3d;
  vec3 xnormal = normalize(normal);
  vec3 xtangent = normalize(tangent) * EPS;
  vec3 xbitangent = normalize(cross(xnormal, xtangent)) * EPS;
  float xdensity = mix(10.0, 0.5, density);

  vec3 bumped = xnormal * bump;
  vec3 pos  = xtex_concreteSurface(xposition, bumped, xdensity);
  vec3 posU = xtex_concreteSurface(xposition + xtangent, bumped, xdensity);
  vec3 posV = xtex_concreteSurface(xposition + xbitangent, bumped, xdensity);

  return normalize(cross(posU - pos, posV - pos));
}
`,
    uniforms: {
        scale: { value: 2, min: 0, max: 4, step: 0.1 },
        density: { value: 0.5, min: 0, max: 1, step: 0.01 },
        bump: { value: 0.5, min: -1, max: 1, step: 0.01 }, // negative flips bumps into dents
        seed: { value: 0, min: 0, max: 100, step: 1 },
    },
};
