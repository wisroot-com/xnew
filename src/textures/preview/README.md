# xtextures preview harnesses (glsl-canvas)

Dev-only fragment shaders for previewing the textures in `../glsl/*.glsl` with the VSCode
**glsl-canvas** extension (`circledev.glsl-canvas`). Never bundled — nothing in `src/` imports them.

Usage: open a `.frag` here → command palette (⇧⌘P) → **"Show glslCanvas"**.

## glsl-canvas extension spec (verified 2026-07)

The extension README is incomplete; the facts below were verified by reading the installed
extension's source (v0.2.15, bundling the glsl-canvas library v0.2.8 — `resources/js/vendors.js`).

### 2D (flat) mode

- The shader is a plain fragment shader over a fullscreen quad.
- Provided uniforms: `u_resolution` (vec2), `u_time` (float), `u_mouse` (vec2),
  `u_camera` (vec3, orbital), `u_texture_N` (via `glsl-canvas.textures` setting),
  custom values via the `glsl-canvas.uniforms` setting.

### 3D modes (box / sphere / torus / mesh)

- **Mode is selected in the preview panel UI, not in settings**: the top button of the
  preview's toolbar opens a mode list (flat / box / sphere / torus / mesh). `mesh` loads
  a custom OBJ (library option; the default mesh is used otherwise).
- The model auto-rotates: `u_modelViewMatrix` / `u_normalMatrix` are updated every frame.
- Geometry attributes: `a_position` (vec4), `a_normal` (vec4), `a_texcoord` (vec2), `a_color` (vec4).
- Matrix uniforms: `u_projectionMatrix`, `u_modelViewMatrix`, `u_normalMatrix` (all mat4).
- **No prelude is prepended to user shaders.** Declare every varying / uniform / attribute
  yourself (the default shaders' declarations exist only in the library's built-in sources).

### Single-file vertex + fragment

If the source contains `#ifdef VERTEX` (or `#if defined(VERTEX)`) at line start, the extension
compiles the same file twice — once with `#define VERTEX` prepended as the vertex shader, once
without as the fragment shader. Without a VERTEX block, a default vertex shader is used, and it
puts the **clip-space** position into `v_position` — useless for object-space texturing. So the
3D harnesses here define their own VERTEX block that keeps object space:

```glsl
#ifdef VERTEX
attribute vec4 a_position;
attribute vec4 a_normal;
void main(void) {
  v_position = a_position;   // stay in OBJECT space — xtextures evaluates there (like xthree.texture)
  v_normal = a_normal;
  gl_Position = u_projectionMatrix * u_modelViewMatrix * a_position;
}
#else
// fragment …
#endif
```

### #include

`#include "relative/path.glsl"` is resolved textually, relative to the shader file,
**only for paths ending in `.glsl`** (regex-based). Includes are expanded before the
VERTEX/fragment split, so included code exists in both stages (fine — unused functions compile).

## Conventions in this directory

**One harness per texture, named `<texture>.frag`**, written in the native-3D single-file style
above (schema consts → VERTEX block → fragment with includes). Every texture def carries both a
color and a normal channel, so every harness shades albedo × perturbed-normal lighting the same way.

`test/textures/xtextures.test.ts` scans every `.frag` here (test-enforced):

- **Consts above the first `#include` must exactly mirror the TS uniform schema defaults**
  (`const float <key> = <value>;` / `const vec3 <key> = vec3(...);`, no extras, no omissions).
  Harness-local constants go below the includes (inside `main` or after them).
- Every `#include` path must exist on disk.
- The filename prefix before the first `-` or `.` must match a def name
  (`concrete.frag` → the `Concrete` def).

Shading in the lit harnesses intentionally matches `xthree.texture` (object-space evaluation,
the same tangent heuristic and `0.55 + 0.45 * diff` lambert), so what you see here is what the
three.js material will look like.

## Files

- `wood.frag` — Wood (color + geometric normal).
- `concrete.frag` — Concrete (color + perturbed normal).
