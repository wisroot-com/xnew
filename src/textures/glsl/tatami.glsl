//----------------------------------------------------------------------------------------------------
// xtexTatami* — tatami mats: a 2x1 mat is the base unit, heri (cloth border) runs along the long
// edges, igusa weave grooves run along the long axis; color and normal share the same masks.
// Requires noise.glsl before it; uniform declarations are generated from the TS schema (tatami.ts).
//----------------------------------------------------------------------------------------------------

float xtex_noise(vec3 P);  // defined in noise.glsl

const float XTEX_TATAMI_PI = 3.141592653589793;

// 1 inside the heri cloth strips along the long edges (v near 0 / 1)
float xtex_tatamiHeri(float v){
  return 1.0 - smoothstep(heri - 0.008, heri + 0.008, min(v, 1.0 - v));
}

// 1 at the butt joint of neighboring mats (short edges); u spans the 2-unit long side as [0,1)
float xtex_tatamiSeam(float u){
  return 1.0 - smoothstep(0.0, 0.01, min(u, 1.0 - u) * 2.0);
}

float xtex_tatamiHeight(vec3 q){
  vec2 cell = vec2(fract(q.x * 0.5), fract(q.y));
  float ridge = abs(sin(XTEX_TATAMI_PI * cell.y * weave));
  float h = mix(ridge, 0.9, xtex_tatamiHeri(cell.y));
  return h * (1.0 - 0.6 * xtex_tatamiSeam(cell.x));
}

vec3 xtexTatamiColor(vec3 position){
  vec3 p = position * exp(scale - 2.0);
  vec2 mat = vec2(p.x * 0.5, p.y);
  vec2 matIndex = floor(mat);
  vec2 cell = fract(mat);

  // per-mat tone: checkered pair + a small per-mat hash so mats do not look identical
  float checker = mod(matIndex.x + matIndex.y, 2.0);
  float hash = xtex_noise(vec3(matIndex.x * 1.7 + 0.37, matIndex.y * 2.3 + 0.58, seed)) * 0.5 + 0.5;
  vec3 base = mix(color, background, clamp(0.7 * checker + 0.3 * hash, 0.0, 1.0));

  // weave: faint ridges along the long axis, each strand row gets a slight tint, plus sun-fade mottling
  float ridge = abs(sin(XTEX_TATAMI_PI * cell.y * weave));
  float strand = xtex_noise(vec3(p.x * 8.0, floor(cell.y * weave) * 0.53, seed + 5.0));
  float mottle = xtex_noise(vec3(p.x * 0.6, p.y * 0.6, seed + 9.0));
  vec3 igusa = base * (0.88 + 0.07 * ridge + 0.06 * strand + 0.08 * mottle);
  // fine faint weft lines parallel to the short edges (integer weave keeps them tiling-safe)
  float weft = abs(sin(XTEX_TATAMI_PI * p.x * weave * 1.5));
  igusa *= 0.95 + 0.05 * weft;
  igusa *= 1.0 - 0.35 * xtex_tatamiSeam(cell.x);

  // heri: flat cloth color, shaded only across v so baked tiles stay seamless along the long axis
  vec3 cloth = border * (0.85 + 0.3 * smoothstep(0.0, heri, min(cell.y, 1.0 - cell.y)));
  return mix(igusa, cloth, xtex_tatamiHeri(cell.y));
}

vec3 xtexTatamiNormal(vec3 position, vec3 normal, vec3 tangent){
  const float EPS = 0.002;
  vec3 p = position * exp(scale - 2.0);
  vec3 xnormal = normalize(normal);
  vec3 xtangent = normalize(tangent) * EPS;
  vec3 xbitangent = normalize(cross(xnormal, xtangent)) * EPS;
  vec3 bumped = xnormal * (0.02 * bump);

  vec3 pos  = p + bumped * xtex_tatamiHeight(p);
  vec3 posU = (p + xtangent) + bumped * xtex_tatamiHeight(p + xtangent);
  vec3 posV = (p + xbitangent) + bumped * xtex_tatamiHeight(p + xbitangent);
  return normalize(cross(posU - pos, posV - pos));
}
