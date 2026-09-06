//----------------------------------------------------------------------------------------------------
// xtexWood* — procedural wood (rings + fibers) as a function of object-space position.
// The surface is flat, so the normal channel returns the geometric normal unperturbed.
// Requires noise.glsl before it; uniform declarations are generated from the TS schema (wood.ts).
//----------------------------------------------------------------------------------------------------

float xtex_noise(vec3 P);  // defined in noise.glsl

vec3 xtexWoodColor(vec3 position){
  float ang = radians(angle);
  float ca = cos(ang), sa = sin(ang);
  vec3 posLocal = vec3(
    position.x*ca - position.y*sa,
    position.x*sa + position.y*ca,
    position.z
  );

  // main ring pattern; one ring cell is scale world units across
  float s = 1.0 / scale;
  vec3 pos = posLocal * s * vec3(1.0/lengths, 4.0, 1.0/lengths) + seed;
  float k = (xtex_noise(pos) + 1.0) * 10.0 * rings;
  k = (cos(k + cos(k)) + 1.0) / 2.0;

  // fibers: 10 octaves of turbulence, high-frequency along y, 2.7x finer than the rings
  float kk = 0.0, sum = 0.0, power = 2.0;
  vec3 sc = s * 2.7 * vec3(1.0, fibersDensity, 1.0);
  for (int i = 0; i < 10; i++){
    kk += power * xtex_noise(posLocal * sc + seed);
    sum += power;
    sc *= 1.8;
    power *= 0.6;
  }
  kk = (sin(kk * 5.0 / sum * 10.0) + 1.0) / 2.0;

  return mix(color, background, mix(k, kk, fibers));
}

vec3 xtexWoodNormal(vec3 position, vec3 normal, vec3 tangent){
  return normalize(normal);
}
