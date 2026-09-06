//----------------------------------------------------------------------------------------------------
// xthree shader material — vertex stage: hand the object-space position / normal to the fragment stage.
// This path has no scene lights, so it also carries one fixed light direction, rotated into object space.
//----------------------------------------------------------------------------------------------------

varying vec3 vXtexPos;
varying vec3 vXtexNormal;
varying vec3 vXtexLight;

void main() {
  vXtexPos = position;
  vXtexNormal = normal;

  // rotate the view-space light into object space: transpose(mat3(mv)) * light
  mat3 mv = mat3(modelViewMatrix);
  vec3 light = normalize(vec3(0.4, 0.7, 0.6));
  vXtexLight = vec3(dot(mv[0], light), dot(mv[1], light), dot(mv[2], light));

  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
