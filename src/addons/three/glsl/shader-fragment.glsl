//----------------------------------------------------------------------------------------------------
// xthree shader material — fragment stage: shade in object space with the material-local light.
// The texture's own glsl and its entry-function prefix are spliced in by resolveGlsl (material.ts).
//----------------------------------------------------------------------------------------------------

varying vec3 vXtexPos;
varying vec3 vXtexNormal;
varying vec3 vXtexLight;

//#include <frame>
//#include <texture>

void main() {
  vec3 nrm = normalize(vXtexNormal);
  vec3 n = XTEX_Normal(vXtexPos, nrm, xtexTangent(nrm));
  vec3 albedo = XTEX_Color(vXtexPos);
  float diff = 0.55 + 0.45 * max(dot(n, normalize(vXtexLight)), 0.0);
  gl_FragColor = vec4(albedo * diff, 1.0);
}
