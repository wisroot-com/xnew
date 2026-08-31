//----------------------------------------------------------------------------------------------------
// xtexTatami* — tatami mats: one mat is a scale-wide cell, centered on the origin so a single mat
// frames on its own; aspect is the mat's real long/short ratio and only sets the pattern's
// proportions, so a 2:1 mat is authored in a square cell and stretched by the mesh itself.
//----------------------------------------------------------------------------------------------------

float xtex_noise(vec3 P);  // defined in noise.glsl

const float XTEX_TATAMI_PI = 3.141592653589793;

// mat space: one mat per unit cell, the origin at a mat's center (so position 0 sits inside one mat, not on a joint)
vec2 xtex_tatamiMat(vec3 p){
  return p.xy + 0.5;
}

// 1 inside the heri cloth strips along the long edges (v near 0 / 1); heri is a fraction of the short side
float xtex_tatamiHeri(float v){
  return 1.0 - smoothstep(heri - 0.008, heri + 0.008, min(v, 1.0 - v));
}

// 1 at the butt joint of neighboring mats (short edges); aspect converts u into short-side units so the joint keeps its width
float xtex_tatamiSeam(float u){
  return 1.0 - smoothstep(0.0, 0.01, min(u, 1.0 - u) * aspect);
}

float xtex_tatamiHeight(vec3 q){
  vec2 cell = fract(xtex_tatamiMat(q));
  float ridge = abs(sin(XTEX_TATAMI_PI * cell.y * weave));
  float h = mix(ridge, 0.9, xtex_tatamiHeri(cell.y));
  return h * (1.0 - 0.6 * xtex_tatamiSeam(cell.x));
}

vec3 xtexTatamiColor(vec3 position){
  vec3 p = position / scale;
  vec2 mat = xtex_tatamiMat(p);
  vec2 matIndex = floor(mat);
  vec2 cell = fract(mat);
  // the long axis in short-side units, so features keep their real pitch whatever the aspect is
  float u = mat.x * aspect;

  // per-mat tone: checkered pair + a small per-mat hash so mats do not look identical
  float checker = mod(matIndex.x + matIndex.y, 2.0);
  float hash = xtex_noise(vec3(matIndex.x * 1.7 + 0.37, matIndex.y * 2.3 + 0.58, seed)) * 0.5 + 0.5;
  vec3 base = mix(color, background, clamp(0.7 * checker + 0.3 * hash, 0.0, 1.0));

  // weave: faint ridges along the long axis, each strand row gets a slight tint, plus sun-fade mottling
  float ridge = abs(sin(XTEX_TATAMI_PI * cell.y * weave));
  float strand = xtex_noise(vec3(u * 8.0, floor(cell.y * weave) * 0.53, seed + 5.0));
  float mottle = xtex_noise(vec3(u * 0.6, mat.y * 0.6, seed + 9.0));
  vec3 igusa = base * (0.88 + 0.07 * ridge + 0.06 * strand + 0.08 * mottle);
  // fine faint weft lines parallel to the short edges; a whole number of periods per mat keeps them tiling-safe
  float weft = abs(sin(2.0 * XTEX_TATAMI_PI * mat.x * floor(aspect * weave * 0.75 + 0.5)));
  igusa *= 0.95 + 0.05 * weft;
  igusa *= 1.0 - 0.35 * xtex_tatamiSeam(cell.x);

  // heri: flat cloth color, shaded only across v so baked tiles stay seamless along the long axis
  vec3 cloth = border * (0.85 + 0.3 * smoothstep(0.0, heri, min(cell.y, 1.0 - cell.y)));
  return mix(igusa, cloth, xtex_tatamiHeri(cell.y));
}

vec3 xtexTatamiNormal(vec3 position, vec3 normal, vec3 tangent){
  const float EPS = 0.002;
  vec3 p = position / scale;
  vec3 xnormal = normalize(normal);
  vec3 xtangent = normalize(tangent) * EPS;
  vec3 xbitangent = normalize(cross(xnormal, xtangent)) * EPS;
  vec3 bumped = xnormal * (0.02 * bump);

  vec3 pos  = p + bumped * xtex_tatamiHeight(p);
  vec3 posU = (p + xtangent) + bumped * xtex_tatamiHeight(p + xtangent);
  vec3 posV = (p + xbitangent) + bumped * xtex_tatamiHeight(p + xbitangent);
  return normalize(cross(posU - pos, posV - pos));
}
