//----------------------------------------------------------------------------------------------------
// glsl-canvas preview harness for wood.glsl — dev-only, never bundled.
// Open in VSCode with the glsl-canvas extension ("Show glslCanvas").
// The consts mirror the uniform schema defaults in wood.ts (uniforms are generated at runtime).
//----------------------------------------------------------------------------------------------------

#ifdef GL_ES
precision highp float;
#endif

uniform vec2 u_resolution;

const float scale = 2.5;
const float rings = 4.5;
const float lengths = 1.0;
const float angle = 0.0;
const float fibers = 0.3;
const float fibersDensity = 10.0;
const float seed = 0.0;
const vec3 color = vec3(0.8, 0.4, 0.0);
const vec3 background = vec3(0.4, 0.1, 0.0);

#include "../glsl/noise.glsl"
#include "../glsl/wood.glsl"

void main() {
  // same mapping as runtime.ts: centered coords scaled by worldSize (default 3)
  vec2 centered = gl_FragCoord.xy - 0.5 * u_resolution;
  vec3 pos = vec3(centered / min(u_resolution.x, u_resolution.y) * 3.0, 0.0);
  gl_FragColor = vec4(xtexWood(pos), 1.0);
}
