//----------------------------------------------------------------------------------------------------
// glsl-canvas preview harness for tatami.glsl on the extension's native 3D modes — dev-only.
// Open "Show glslCanvas", then pick box / sphere / torus / mesh with the preview toolbar's mode button.
// Custom VERTEX keeps v_position/v_normal in OBJECT space, so texturing matches xthree.texture.
//----------------------------------------------------------------------------------------------------

#ifdef GL_ES
precision highp float;
#endif

varying vec4 v_position;
varying vec4 v_normal;

uniform mat4 u_projectionMatrix;
uniform mat4 u_modelViewMatrix;
uniform mat4 u_normalMatrix;

const float scale = 2.0;
const float weave = 30.0;
const float heri = 0.04;
const float bump = 0.5;
const float seed = 0.0;
const vec3 color = vec3(0.72, 0.71, 0.42);
const vec3 background = vec3(0.66, 0.68, 0.38);
const vec3 border = vec3(0.23, 0.21, 0.14);

#ifdef VERTEX

attribute vec4 a_position;
attribute vec4 a_normal;

void main(void) {
  v_position = a_position;
  v_normal = a_normal;
  gl_Position = u_projectionMatrix * u_modelViewMatrix * a_position;
}

#else

#include "../glsl/noise.glsl"
#include "../glsl/tatami.glsl"

void main() {
  // object-space evaluation + view-space lighting, same shading as xthree.texture
  vec3 pos = v_position.xyz;
  vec3 nrm = normalize(v_normal.xyz);
  vec3 tng = normalize(abs(nrm.y) < 0.99 ? cross(vec3(0.0, 1.0, 0.0), nrm) : cross(vec3(1.0, 0.0, 0.0), nrm));
  vec3 perturbed = xtexTatamiNormal(pos, nrm, tng);
  vec3 nview = normalize((u_normalMatrix * vec4(perturbed, 0.0)).xyz);

  vec3 albedo = xtexTatamiColor(pos);
  vec3 light = normalize(vec3(0.4, 0.7, 0.6));
  float diff = 0.55 + 0.45 * max(dot(nview, light), 0.0);
  gl_FragColor = vec4(albedo * diff, 1.0);
}

#endif
