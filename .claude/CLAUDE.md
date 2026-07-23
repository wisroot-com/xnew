# xnew

A JavaScript / TypeScript library for component-oriented programming.
Well-suited for applications with dynamic scenes and game development.

## Concept

xnew is a **component-oriented** library: an application is built by composing
small, self-contained components, each bundling its own DOM, lifecycle, and
events into a single unit that can be created and disposed as one.

## Tech Stack

- Language: TypeScript 5
- Bundler: Rollup 3 (emits ESM / CJS / d.ts)
- Testing: Jest 29 + jest-environment-jsdom + ts-jest
- Transpiler: Babel (@babel/preset-env)

## Addons

Integrations for games and interactive apps.

- `addons/xpixi` — PixiJS 8
- `addons/xthree` — Three.js
- `addons/xmatter` — matter-js (2D physics)
- `addons/xrapier2d` — Rapier 2D
- `addons/xrapier3d` — Rapier 3D

## Directory Layout

- `src/core/` — `xnew` core: `unit`, event, time, map, env, dom
- `src/sync/` — networking layer (exported as `xsync`): a single `xsync.ts` (shared state + boot + facade). Lobby/room "gathering place" wiring is not built in — callers assemble it from the facade (see `examples/*/server.js` + `index.js`).
- `src/audio/` — audio layer (exported as `xaudio`): a facade `xaudio.ts` (`load` / `synthesizer` / `volume`) over the AudioTrack / Synthesizer components and the shared master bus (`master.ts`)
- `src/basics/` — built-in basic components (exported as `xbasics`); one component per file, grouped by category: `stage/`, `element/`, `widget/`
- `src/icons/` — heroicons icon set (exported as `xicons`); path data lives in one generated `data.ts` table, `xicons.ts` builds a component per entry from it, and `Template.ts` is the shared `<svg>` shell; path data verbatim from heroicons (MIT — `license.txt`)
- `src/textures/` — procedural textures (exported as `xtextures`); shader-first WebGL2 rendering, three-free core. One `define/<name>.ts` per texture (TextureSource: name / glsl / ranges / presets); GLSL bodies live in real `glsl/*.glsl` files (imported as strings — rollup inline plugin + `test/transform-glsl.cjs`; uniform declarations are generated from the TS schema); `preview/*.frag` are dev-only glsl-canvas harnesses, never bundled
- `src/addons/` — third-party library integrations
- `examples/` — runnable samples
- `docusaurus/` — Docusaurus documentation site
- `test/` — Jest tests

## Scripts

- `npm test` — run Jest
- `npm run build` — build with Rollup
- `npm run dev` — Rollup in watch mode

## Function style

Prefer function declarations over arrow-function expressions assigned to a
`const`. Write `function func() { ... }`, not `const func = () => { ... }`.
Reserve arrow functions for inline callbacks and short expressions where a
declaration doesn't fit.

## File header convention (src/)

Every file under `src/` starts with a compact overview comment in the `//----` divider
style, with **at most three comment lines** between the dividers: line 1 is the role
(`<Name> — <responsibility>`); lines 2–3 are optional and carry only the most
load-bearing non-obvious point (design intent, invariant, or caveat). No API
inventories, usage examples, or change history — keep per-symbol detail in JSDoc.

```ts
//----------------------------------------------------------------------------------------------------
// <Name> — <role: one line>
// <optional: up to two lines of non-obvious intent / invariant / caveat>
//----------------------------------------------------------------------------------------------------
```

Code blocks inside a file are separated with the same divider style:

```ts
//----------------------------------------------------------------------------------------------------
// code block header
//----------------------------------------------------------------------------------------------------
```