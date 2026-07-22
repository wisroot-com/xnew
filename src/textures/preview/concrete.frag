//----------------------------------------------------------------------------------------------------
// glsl-canvas preview harness for concrete.glsl — dev-only, never bundled.
// Shows the flat-slice normal encoded as a normal-map image (n * 0.5 + 0.5), same as runtime.ts.
// The consts mirror the uniform schema defaults in concrete.ts (uniforms are generated at runtime).
//----------------------------------------------------------------------------------------------------

#ifdef GL_ES
precision highp float;
#endif

uniform vec2 u_resolution;

const float scale = 2.0;
const float density = 0.5;
const float bump = 0.5;
const float seed = 0.0;

#include "../glsl/noise.glsl"
#include "../glsl/concrete.glsl"

void main() {
  vec2 centered = gl_FragCoord.xy - 0.5 * u_resolution;
  vec3 pos = vec3(centered / min(u_resolution.x, u_resolution.y) * 3.0, 0.0);
  vec3 n = xtexConcrete(pos, vec3(0.0, 0.0, 1.0), vec3(1.0, 0.0, 0.0));
  gl_FragColor = vec4(n * 0.5 + 0.5, 1.0);
}
