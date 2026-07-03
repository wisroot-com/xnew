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
- `src/sync/` — networking layer (exported as `xsync`): internal / boot / facade / components
- `src/basics/` — built-in basic components (exported as `xbasics`)
- `src/addons/` — third-party library integrations
- `examples/` — runnable samples
- `website/` — Docusaurus documentation site
- `test/` — Jest tests

## Scripts

- `npm test` — run Jest
- `npm run build` — build with Rollup
- `npm run dev` — Rollup in watch mode

## File header convention (src/)

Every file under `src/` must start with an overview comment so that humans and AI
can grasp the file in a glance, without reading the implementation. Use the same
`//----` divider style already used inside the codebase. See [src/core/map.ts](../src/core/map.ts)
for a reference.

**Required elements**

1. **Role** — one-line title naming the file's responsibility (not just its filename).
2. **Why** — ideally one line (two at most) on the design intent that the code itself
   does not reveal. Keep it terse; do not restate the implementation.
3. **Public API inventory** — bullet list of **only the features consumed from outside**
   (the public surface callers use), each with a one-line description. Omit internal
   exports, transport types, and helper accessors. For a facade file, list the facade
   methods (e.g. `xnew.sync.*`), not every `export`.

**Optional, add when they aid comprehension**

- **Relationships** — which other files depend on this, or what this depends on,
  when the file plays a central role in the architecture.
- **Invariants / lifecycle / ownership rules** — implicit contracts the code relies on.
- **Usage example** — a minimal snippet, especially for user-facing files in
  `basics/` and `addons/`.
- **Caveats** — non-obvious behaviors a reader would otherwise miss.

**Do not write**

- Per-line implementation explanations (the code already shows the *what*).
- Change history or authorship (use `git log`).
- TODO lists (track them elsewhere).
- Full API reference — keep per-symbol detail in JSDoc, not the file header.

**Per-directory emphasis**

| Directory     | Focus                                                                |
| ------------- | -------------------------------------------------------------------- |
| `src/core/`   | Role, invariants, relationship to other core files                   |
| `src/sync/`   | Role, invariants, which layer (internal/boot/facade/components) the file is |
| `src/basics/` | User-facing component behavior and a small usage example             |
| `src/addons/` | Integration target (and version), boundary with xnew, lifetime model |

**Template**

```ts
//----------------------------------------------------------------------------------------------------
// <Role: one line>
//
// <Why: one line (two at most) of design intent the code does not reveal.>
//
// - <PublicFeatureA> : <one-line description>   // only externally-consumed features
// - <PublicFeatureB> : <one-line description>
//
// (optional) Relationships / Invariants / Caveats / Example
//----------------------------------------------------------------------------------------------------
```
