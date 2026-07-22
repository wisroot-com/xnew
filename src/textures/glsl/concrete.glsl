//----------------------------------------------------------------------------------------------------
// xtexConcrete* — bumpy concrete from one shared height field: Color tints crevices vs bumps,
// Normal perturbs via finite differences (EPS = 0.001).
// Requires noise.glsl before it; uniform declarations are generated from the TS schema (concrete.ts).
//----------------------------------------------------------------------------------------------------

float xtex_concreteHeight(vec3 p, float d){
  return pow(abs(xtex_noise(p) * 0.5 + 0.5), d);
}

vec3 xtex_concreteSurface(vec3 p, vec3 n, float d){
  return p + n * xtex_concreteHeight(p, d);
}

vec3 xtexConcreteColor(vec3 position){
  vec3 seed3d = sin(vec3(1.0, 2.0, 3.0) * seed) * 100.0;
  vec3 p = position * exp(scale / 2.0 + 2.0) + seed3d;
  float xdensity = mix(10.0, 0.5, density);

  // the same height field as the normal channel, so stains track the relief
  float k = xtex_concreteHeight(p, xdensity);
  float mottle = xtex_noise(p * 0.35) * 0.5 + 0.5;
  float grain = xtex_noise(p * 3.0) * 0.5 + 0.5;

  vec3 base = mix(background, color, mottle * 0.7 + grain * 0.3);
  return base * mix(0.8, 1.05, k);
}

vec3 xtexConcreteNormal(vec3 position, vec3 normal, vec3 tangent){
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
