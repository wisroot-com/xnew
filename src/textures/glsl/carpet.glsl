//----------------------------------------------------------------------------------------------------
// xtexCarpet* — a fluffy pile carpet: a dense field of fine fibers under a soft cloudy drift.
// The look lives in low contrast — plush shows no deep gaps, only faint hairs and gentle shading.
// Requires noise.glsl before it; uniform declarations are generated from the TS schema (carpet.ts).
//----------------------------------------------------------------------------------------------------

float xtex_noise(vec3 P);  // defined in noise.glsl

const float XTEX_CARPET_PI = 3.141592653589793;

// nap space: the plane turned by angle, so the fibers can be aimed without turning the mesh
vec3 xtex_carpetSpace(vec3 position){
  float a = radians(angle);
  vec3 p = position / scale;
  return vec3(p.x * cos(a) - p.y * sin(a), p.x * sin(a) + p.y * cos(a), p.z);
}

// one fiber layer, 0 between the hairs to 1 on a lit one; the lean is fixed per layer because a rotating direction field twists the ridges into marble swirls when magnified
float xtex_carpetFibers(vec2 uv, float freq, float lean, float ofs){
  vec2 dir = vec2(cos(lean), sin(lean));
  vec2 r = vec2(dot(uv, dir), dot(uv, vec2(-dir.y, dir.x))) * freq;
  // a wobble the width of a hair: it makes them waver without the large-scale flow a rotation would add
  r += 0.6 * vec2(xtex_noise(vec3(r.yx * 0.5, seed + ofs)), xtex_noise(vec3(r * 0.5, seed + ofs + 2.0)));
  float ridge = 1.0 - abs(xtex_noise(vec3(r * vec2(0.35, 1.0), seed + ofs + 3.0)));
  // a second field along the lean chops each ridge into separate hairs
  float cut = 0.5 + 0.5 * xtex_noise(vec3(r * vec2(4.0, 0.35), seed + ofs + 11.0));
  // only the top of the ridge is a visible hair; fluff lowers that cut, blending the hairs into plush
  return smoothstep(mix(0.85, 0.55, fluff), 1.0, ridge * (0.6 + 0.6 * cut));
}

// the broad drift of light across the pile — plush is never evenly lit
float xtex_carpetCloud(vec2 uv){
  return 0.75 + 0.5 * (xtex_noise(vec3(uv * 1.3, seed + 21.0)) * 0.5 + 0.5);
}

// pile height: three layers crossing at their own leans, combined brightest-wins because hairs overlap rather than average; swirl spreads the leans apart, 0 combing them all along the nap
float xtex_carpetHeight(vec3 q){
  vec2 uv = q.xy;
  float spread = swirl * XTEX_CARPET_PI;
  float fibers = xtex_carpetFibers(uv, density, 0.0, 1.0);
  fibers = max(fibers, 0.9 * xtex_carpetFibers(uv, density * 1.7, spread / 3.0, 7.0));
  fibers = max(fibers, 0.8 * xtex_carpetFibers(uv, density * 2.6, 2.0 * spread / 3.0, 13.0));
  return clamp((0.3 + 0.7 * fibers) * xtex_carpetCloud(uv), 0.0, 1.0);
}

// relief for the normal channel: a soft isotropic swell, not the color field — its leaning ridges would light up as grooves, and its hairs sit below a texel and would difference into static
float xtex_carpetRelief(vec3 q){
  float grain = xtex_noise(vec3(q.xy * density * 0.8, seed + 51.0)) * 0.5 + 0.5;
  float lump = xtex_noise(vec3(q.xy * density * 0.25, seed + 57.0)) * 0.5 + 0.5;
  return clamp(xtex_carpetCloud(q.xy) * (0.45 + 0.3 * lump + 0.25 * grain), 0.0, 1.0);
}

vec3 xtexCarpetColor(vec3 position){
  vec3 q = xtex_carpetSpace(position);
  float h = xtex_carpetHeight(q);
  // dye blotches: the two yarn tones drift slowly across the rug, the lit hairs catching the lighter one
  float dye = xtex_noise(vec3(q.xy * 0.8, seed + 31.0)) * 0.5 + 0.5;
  vec3 yarn = mix(background, color, clamp(0.45 + 0.35 * dye + 0.3 * h, 0.0, 1.0));
  return yarn * mix(1.0 - shade, 1.0, h);
}

vec3 xtexCarpetNormal(vec3 position, vec3 normal, vec3 tangent){
  // the step follows the fiber size: a fixed one would fall inside the grain and difference into noise
  float EPS = 0.5 / density;
  vec3 q = xtex_carpetSpace(position);
  vec3 xnormal = normalize(normal);
  vec3 xtangent = normalize(tangent) * EPS;
  vec3 xbitangent = normalize(cross(xnormal, xtangent)) * EPS;
  vec3 bumped = xnormal * (0.02 * bump);

  vec3 pos  = q + bumped * xtex_carpetRelief(q);
  vec3 posU = (q + xtangent) + bumped * xtex_carpetRelief(q + xtangent);
  vec3 posV = (q + xbitangent) + bumped * xtex_carpetRelief(q + xbitangent);
  return normalize(cross(posU - pos, posV - pos));
}
