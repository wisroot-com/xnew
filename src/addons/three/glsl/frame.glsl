//----------------------------------------------------------------------------------------------------
// xtexTangent — a stable tangent for object-space texturing: any vector perpendicular to the normal.
// Both material paths must build the frame the same way, or the same texture shades differently in each.
//----------------------------------------------------------------------------------------------------

vec3 xtexTangent(vec3 n) {
  return normalize(abs(n.y) < 0.99 ? cross(vec3(0.0, 1.0, 0.0), n) : cross(vec3(1.0, 0.0, 0.0), n));
}
