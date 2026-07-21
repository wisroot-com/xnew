# xnew coding rules

Conventions and pitfalls for writing code with the xnew library. Read this
before implementing; append to **Pitfalls / lessons learned** whenever a mistake
is found. Source of truth is the code in `src/core/` — when in doubt, read it.

---

## 1. Mental model

- xnew is **component-oriented**. An app is a tree of **units**. A `Unit` bundles
  a DOM element, a lifecycle, listeners, child units, and timers, and is created
  and disposed as one.
- A **component function** has the shape `function Foo(unit, props) { … }`. The
  first argument is always the unit; the second is the props object.
- Lifecycle phases: `invoked → initialized → started ↔ stopped → finalizing → finalized`.
  The component body runs during `invoked`. Some APIs are **init-only** (see §3).

## 2. Component functions & defines (the public API of a unit)

- To expose an API from a component, **return an object** from the component
  function. Each entry is merged onto the unit, so callers can do `unit.method()`
  or `xnew(Foo).method()`.
- **Defines may only be functions, getters, or setters — never plain values.**
  `Unit.extend` throws `Only function properties can be defined as Component defines.`
  ```js
  return { value: 5 };                         // ❌ throws
  return { get value() { return n; }, inc() { n++; } };  // ✅
  ```
- Defines are wrapped so they run in the unit's scope automatically.
- Prefer reading your **own** state from local closures, not back off `unit.x`.
  Reading your own defines via `unit.x` works at runtime only after the body has
  finished attaching them (so only inside deferred callbacks), and it bypasses
  the typed locals you already have.
- **Return the defines object literal directly** — no `const defines = { … }; return defines;`.
  When one define calls a sibling define, call it as `unit.x(...)` (safe: defines are
  attached before any define can run), not through a named local object.

## 3. Creating units — `xnew(...)`

- `xnew(Component, props)` — create a child of the **current** unit.
- `xnew(parentUnit, Component, props)` — create under an explicit parent unit
  (runs in that parent's scope). Used to mount siblings/children outside the body.
- `xnew('<div class="…">', …)` / `xnew(domElement, …)` — the unit's element is
  that DOM target. A tag string creates and nests the element.
- `xnew(target, 'text')` / `xnew('text')` — sets `textContent` (safe for user input).
- `xnew(target, (unit) => { … })` — an inline component function.
- `xnew(Base, props?, (unit, props) => { … })` — a **trailing function after a component**
  is an **extension component** (`ExComponent`) extended on top of `Base` (props optional).
  Equivalent to `xnew((unit) => { xnew.extend(Base, props); … })`: `Base` is extended first,
  then the `ExComponent` runs on the same unit; both receive `props`. Defines from both merge
  onto the unit.
- `xnew(Base, props?, 'text')` — a **trailing string/number after a component** is an
  `ExComponent` too: it becomes a component that sets the unit's current element `textContent`
  (same wrapper as the base-position `xnew(target, 'text')` form). Runs after `Base`, so it
  writes into whatever element `Base`'s body ended on (e.g. `ListboxItem`'s row).
- **Init-only helpers** (throw if called after `invoked`, i.e. outside the
  synchronous body or in a later callback): `xnew.nest`, `xnew.extend`,
  `sync.server`, `sync.client`, `sync.register`, `sync.state`.

## 4. DOM: element, nest, events

- `unit.element` is the unit's current DOM element.
- `xnew.css((layer,) { name: 'decls…' })` registers pseudo-scoped CSS with **mandatory
  scoping**: every key is a local name, always renamed to a page-unique one, and keys must
  match `[A-Za-z][A-Za-z0-9_-]*` (anything else throws) — there is no way to emit a global
  rule. A value is always a **CSS fragment string**: a **declaration block**, wrapped as
  `.xnewN-key { … }` (native CSS nesting works inside: `&:hover`, `&[data-checked]`, `@media`,
  descendant selectors), or a **nameless at-rule** `@type { … }` that hangs the generated name
  on it — `turn: '@keyframes { from {…} to {…} }'` emits a **scoped animation**
  `@keyframes xnewN-turn { … }`. A name inside the at-rule (`@keyframes spin { … }`) throws, so
  scoping always holds. `$key` inside a value references another entry's generated name —
  `animation: $turn 0.8s linear infinite;` — and an unknown `$key` throws (a letter must
  follow `$`, so `[href$=".png"]` is untouched). An **optional `layer` string first argument**
  wraps the whole block in `@layer` (invalid layer throws). The return value maps each key to
  its generated name (typed via `keyof`) to embed in tag strings
  (`xnew.nest(`<div class="${css.name}">`)`). Identical definitions share one ref-counted
  `<style>`, removed when the last user unit finalizes; on the server (no DOM) keys map to
  themselves and nothing is injected.
  Calls without a `layer` argument stay unlayered (normal strength). **Every xnew.css call
  inside `src/basics/` must pass `'base'` as the layer argument** — component defaults are
  overridable-by-design:
  any unlayered page CSS (or a later layer) overrides them regardless of specificity or order.
  The target position is **above reset/preflight styles, below page component / utility
  layers** — not simply weakest, or resets (`border: 0 solid` etc.) wipe the defaults. Using
  the `base` name achieves this with no page setup: on Tailwind v4 pages the entries join
  Tailwind's own `base` layer (its order statement comes first) where the generated classes
  beat preflight's element/universal selectors by specificity, while `components` / `utilities`
  outrank by layer order. Only pages that declare their own custom layers need an up-front
  `@layer base;` pin to keep it the weakest layer; unlayered resets still beat the defaults —
  wrap them with `@import url(...) layer(...)`.
  Sharing across components: share the **definition object** (same defs → same names);
  for theming, custom properties (`--vars`) pass through unrenamed and inherit down the
  DOM — set them on a subtree root class, read via `var(--x, fallback)` in descendants.
- **A `basics` component's top-level element is its own `container` (there is NO Container helper —
  it was removed 2026-07).** Every component nests its top element directly with an
  `@layer base` css entry, and the caller's `className` / `style` decorate that element:
  `xnew.nest({ tag: 'div', className: `${css.container} ${className}`, style })`.
  Single-element components (Button, Image, InputNumber, InputText, SVG, SVGText)
  ALSO spread `...others` onto that element; multi-part form components (InputCheckbox / InputRadio /
  InputRange / InputSwitch / Listbox) carry the framed look (border / radius / state tints) ON the
  container itself (frame merged in, 2026-07), and `value` / `name` / rest members go to the inner
  hidden native input. State attributes (`data-checked` / `data-open`) toggle on the container; inner
  parts (knob / meter / status / mark) react via parent-keyed rules (`[data-checked] > & { … }`).
  There is no `container` getter anywhere; for InputCheckbox / InputRange / InputSwitch `unit.element`
  IS the container (input / knob / meter are children) — for the others it ends on the innermost
  nested part, so capture the container right after nesting it when the component needs it later.
- **Basics components expose NO part-customization bag** (no `attributes` / `designs` prop — all
  removed 2026-07). A caller restyles only via `className` / `style` on the container, which reaches
  inner parts through inheritance — the frame border, the knob / meter background, and the state tint
  all key on `currentColor`, so a single `className: 'text-indigo-600'` recolors the whole control
  cohesively. For structural change, InputCheckbox / InputRange / InputSwitch accept a **trailing
  compose function** that replaces their default inner content — the mark, the meter + status, the
  knob respectively (`xnew.standalone === true` gate). Generated
  class names are page-unique, so page CSS cannot target inner parts directly by design.
- `xnew.nest(tagOrDef, textContent?)` creates a child element from a **tag string**
  (`'<div …>'`) or an **element definition object** — an existing element is rejected
  (`invalid tag string`); the optional second argument sets the element's text. The object
  form `{ tag, className?, style?, …members }` is for computed / conditional attributes:
  `className` / `style` are embedded (escaped) in the generated tag string; every other
  member is assigned onto the created element afterwards (property when it exists —
  `value`, `placeholder`, `name`, `checked`, … — else `setAttribute`; on SVG elements
  always `setAttribute`, because SVG DOM properties like `viewBox` are read-only animated
  values and a property write would throw in browsers — jsdom won't catch it. SVG member
  names may be camelCase: they are auto-converted to kebab-case (`strokeWidth` →
  `stroke-width`) except the natively camelCase SVG attributes (`viewBox`,
  `preserveAspectRatio`, … — see `svgAttributeName` in dom.ts)), so arbitrary text
  cannot break the tag string; `undefined` / `null` / `false` members are skipped
  (`name: name ? name : undefined`). `xnew(...)` accepts the same object in the tag-string
  position. **Use the tag string for static markup, the object form once attributes are
  computed or conditional.** It nests the new element under
  the current element and makes it current (init-only). To render into an existing
  element, bind it at unit creation instead: `xnew(element, Component)` (also works
  as a boot target: `xsync.boot(opts, element, Component)`). `xnew.extend(Base)`
  mixes another component into this unit.
- DOM events are listened with `unit.on('click', ({ event }) => …)`. The payload is
  always `{ type, … }` plus event-specific fields:
  - default: `{ event }`
  - `click` / `pointer*`: `{ event, position }`
  - `change` / `input`: `{ event, value }`
  - `wheel`: `{ event, delta }`, `drag*`: `{ event, position, delta }`
  - `window.`/`document.` prefix attaches to window/document; `.arrow`/`.wasd` give `{ event, vector }`.
- `unit.on('a b c', fn)` registers one listener for several space-separated types.
- `unit.once(type, fn)` registers a self-removing listener (removed *before* invocation,
  so an emit inside the listener cannot re-fire it; with space-separated types each type
  fires once independently). Use it instead of the `on` + `off(type)` dance for one-shot
  events like `'+gameover'`. Unlike `on`, duplicate `once(type, fn)` calls register twice.
- **Blanket `off()` is owner-scoped.** Each listener records the unit whose scope
  registered it; `unit.off()` / `unit.off(type)` remove only listeners the *calling*
  unit registered, so one unit cannot strip another component's internals (e.g.
  `system.off()` no longer breaks Accordion/Popup subscribed via `context`).
  `unit.off(type, listener)` with an explicit listener removes regardless of owner.
  When a unit finalizes, its listeners registered on *other* units are detached
  automatically (no stale cross-unit residue).

## 5. Lifecycle events

- `unit.on('update' | 'finalize', cb)`. There is **no** `start`/`stop`/`render`
  event — a unit begins ticking (`update`) as soon as it is `initialized` and stops
  only on `finalize` (no pause/resume state, no separate render pass). Lifecycle is
  `invoked → initialized → finalizing → finalized`.
- `update` callbacks receive `{ count, delta }` (`delta` = ms since last frame;
  `count` starts at 0 per listener). `finalize` gets `{ type }`.
- **Do all teardown in `'finalize'`**: remove external listeners, disconnect
  sockets, clear non-xnew timers. Children finalize before parents, in reverse.

## 6. Custom events — `+` (broadcast) and `-` (local)

- `xnew.emit('+event', payload)` → every **visible** unit that listens for
  `'+event'` (subject to `xnew.protect()` boundaries).
- `xnew.emit('-event', payload)` → only the **current** unit's own `'-event'`
  listeners. This is the idiom for forwarding an external/socket event to the host
  unit: the socket handler does `xnew.emit('-roomcreated', payload)` and the host
  listens with `unit.on('-roomcreated', …)`.
- `xnew.protect()` marks the current unit as a boundary: descendants become
  invisible to `+event` emits and `find` from outside the subtree.

## 7. Scope rule for external/async callbacks (critical)

Any callback that fires **outside** the component body and **outside** an xnew
lifecycle tick — `socket.on`, `addEventListener` you attach yourself, raw
`setTimeout`, promise `.then` from a non-xnew promise — must be wrapped in
`xnew.scope(...)` so it re-enters the unit's scope. Without it, `xnew.emit`,
`xnew()`, `xnew.context`, etc. act on the wrong (or no) current unit.

```js
socket.on('statusupdate', xnew.scope((payload) => xnew.emit('-update', payload)));
```

## 8. Timers — use xnew, not raw setTimeout

- `xnew.timeout(cb, ms)`, `xnew.interval(cb, ms, iterations=0)`,
  `xnew.transition(cb, ms, easing)`. They live under the unit (auto-cleared on
  finalize) and run their callback in scope.
- timeout/interval callbacks get `{ count }` (iteration count from 0); transition
  gets `{ value }` (0→1). Cancel with `clear()` on the returned timer. Prefer these
  over `setTimeout`/`setInterval` for anything tied to a unit's lifetime.

## 9. Context & find

- `xnew.context(Component)` → the nearest ancestor unit created/extended with that
  component (its exposed defines are accessible). **Returns `any`** — no type
  checking, so a typo or wrong shape will not be caught at compile time.
- `xnew.find(Component, { key })` → array of matching units (respects `protect`).
- `key` is a **reserved prop** used by `find(..., { key })`; assume it is globally
  unique.

## 10. Scene navigation (`xbasics.Scene`)

- **Scene is the navigator; the mounted unit itself is the navigation state.**
  A scene component does `xnew.extend(xbasics.Scene)` to get:
  `unit.change(Component, props?)` — mount the next scene under `unit.parent` and
  finalize this one (swappable scenes must share a parent container); and
  `unit.add(Component, props)` — child under the scene unit, finalized together
  with it (returns the unit). Navigation is **by component** only — there is no
  label form and no SceneList lookup table (both removed 2026-07). From a
  descendant, use `xnew.context(xbasics.Scene).change/add(...)`. Scenes are
  recreated from props; they do not preserve state across moves.
- **Scene leave protocol (out-in): a scene opts into an exit transition by returning a
  `leave()` define; entrance effects need no protocol (do them in the component body).**
  `change` calls the unit's own `leave()` and waits for its return value — return the
  timer from `xnew.transition(...)` directly, or nothing (immediate) — then mounts the
  next scene and finalizes itself. While a leave is pending, further `change` calls on
  that scene are ignored (per-scene guard).

## 11. sync — multiplayer (server ↔ client)

- `sync.server(cb)` / `sync.client(cb)` run `cb` **only** in that runtime
  (Node = server, browser = client; auto-detected). They behave like `extend`: the
  object `cb` returns becomes defines on the unit. They are init-only.
- A component mounted on both sides reads a **different prop shape** per side.
  Split the props into explicit types and cast inside each block, e.g.
  `RoomServerProps` / `RoomClientProps`, then
  `const { io } = props as RoomServerProps;`.
- `sync.boot({ io, room }, Component)` (server) / `sync.boot({ io, client, room }, Component)`
  (client) creates a synced root. On the **client** side boot calls `io(...)` to
  create **and own** the socket, with a **flat string** handshake query
  (`io({ query: { roomId: room.id, clientName: client?.name ?? '' }, forceNew: true })`),
  forwards the socket's `connect`/`disconnect`/`notfound` to the boot **parent** (host)
  unit as `-connect`/`-disconnect`/`-notfound`, and disconnects it on finalize. Callers
  (e.g. an example's `Room` component) just boot — they no longer touch the socket. `sync.state`,
  `sync.register`, `sync.emitToServer`, `sync.emitToClients` operate on the current sync root.
- Socket handlers run outside the tick → wrap them in `xnew.scope` (§7).
- **Wire event names vs host event names are independent.** A socket/wire event
  (`'roomcreated'`) and the host-facing unit event it is forwarded to
  (`'-roomcreated'`) are separate strings; keep their mapping deliberate.
- **Send events with `sync.emitToServer` / `sync.emitToClients` — they name the side the
  event fires on, not the direction you happen to call from.** Receive both with
  `unit.on(type, ({ id, ...props }) => …)` (`id` = sender socket id).
  - `sync.emitToServer(type, props)` → fires `type` on the **server**. From a client it
    travels over the socket (a `'-type'` is scoped to the server unit sharing the
    sender's `syncId`); on the server it is a local emit (identical to `xnew.emit`,
    so `'+'`/`'-'` only).
  - `sync.emitToClients(type, props, ids?)` → fires `type` on the **clients** via the
    server. From a client it round-trips through the server to every client incl. the
    sender (`id` = sender); from the server it broadcasts (`id` = `undefined`). `ids`
    limits delivery to those client ids (default: the whole room). This is the
    built-in room broadcast — don't hand-roll a relay component.
  - There is **no** `sync.emit`/`sync.message` anymore. The wire events
    `sync:toServer` / `sync:toClient` / `sync:deliver` are reserved — don't use them
    as app `type`s.
- **Per-client state projection — `sync.visibleTo(target)`.** The server captures the sync tree
  **once per connected client** and emits each socket its own projection. By default a node is
  **public** (reaches every client). `sync.visibleTo(clientId | clientId[] | (clientId) => boolean | null)`
  restricts the **current** sync node — **and its whole subtree**, since hidden children would lose
  their parent link — to the clients it names; `null` makes it public again. Declare it in the
  component's `sync.server` block so private state (hands, roles) **never reaches the wire** for
  excluded clients — hiding on the client is not secure (DevTools sees the payload). The predicate is
  **re-evaluated every capture**, so close over a flag (`revealed`) and flip it for a dynamic reveal —
  no re-call needed. Typical shape: one `PlayerView` per client, `sync.visibleTo(ownerId)`, spawned on
  `sync.connect` and removed on `sync.disconnect` (see `examples/1_xnew/sync/hidden-info/`).

## 12. TypeScript notes

- `Unit` has an index signature `[key: string]: any`. Declared members keep their
  types; **undeclared access (`unit.foo`) resolves to `any` and is NOT a typo
  check.** This is the price of runtime-attached defines — rely on local typed
  closures for your own state.
- `xnew(Component)` returns `Unit & DefinesOf<Component>` (defines typed via the
  component's return type). `xnew.extend(Component)` returns a **bare**
  `DefinesOf<Component>` (no `Unit`, so it stays strictly typed).
- `DefinesOf` only sees the component **function's own return**. Defines added via
  `sync.server` / `sync.client` / nested `extend` are NOT in `DefinesOf`, so
  `xnew(Comp).thatDefine` is `any` (allowed via the index signature, not typed).
- `io` / `socket` are `any` (socket.io handles passed straight through). `conn`,
  `payload` in handlers are typically `any` — match the surrounding style.

## 13. Workflow

- Run tests with `npm test` (Jest + ts-jest + jsdom). After a change, run the
  affected tests and confirm green; type errors fail the suite under ts-jest.
- `examples/dist/` (`xnew.mjs`, `xnew.d.ts`) is a **tracked build artifact**.
  After changing `src/` in a way that affects it, regenerate with `npm run build`
  — never hand-edit it. Commit the regenerated dist alongside the source.
- Every file under `src/` starts with the `//----` header comment — at most three
  compact lines (role, plus optional non-obvious intent / caveat). See `.claude/CLAUDE.md`
  for the exact convention and keep it current when behavior changes.

---

## Pitfalls / lessons learned

Append here when a mistake is found. Newest at the top. Keep each terse:
the rule, then one line of why.

- **`xpixi.nest()` never takes an EXISTING object — it always creates a fresh group Container and moves
  the current parent into it (stateful); `xpixi.add(obj)` attaches a leaf/display object without moving.
  Place leaves with `add`, never hand-`addChild`.** Its only argument is an optional transform config
  `{ position: {x,y}, scale: number|{x,y}, rotation }` applied to the new group (added 2026-07) — a
  convenience for `xpixi.nest().position.set(x, y)`, NOT a way to pass in a pre-made object.
  Rationale: in Pixi v8 every display object (Text/Sprite/Graphics) extends Container, so accepting a
  leaf would let `nest(a); nest(b)` reparent `b` under `a` (a title dragged the guide text off-screen).
  Restricting the arg to plain transform values keeps that footgun structurally impossible — the only
  way to place a leaf is `add`, which never changes the current parent; two `nest()` calls = a group
  inside a group (legit).
  **`xthree.nest()` / `xthree.add()` work identically** (nest() makes a `THREE.Group`; its transform
  config is 3D — `position/scale/rotation` take `{x,y,z}`, z optional); Three meshes / lights are
  leaves → `add`, only `Object3D` / `Group` were the real groups (they keep `.add(child)`).

- **`xpixi.nest()` makes only the child units created AFTER it (in the same body / later in the same
  unit's scope) nest into that group — call it FIRST, then spawn the actors.**
  `nest` does `addContext(parent, …, Nest, …)`, so the Nest context is threaded onto the parent's
  evolving context chain and inherited by *subsequently* created siblings (not earlier ones, not
  units created in a sibling's scope). A scrolling-camera World therefore does
  `const view = xpixi.nest()` up top, then `xnew(Player/Enemy/Coin)` below, and moves
  `view.x` to scroll them all; anything nested from a unit that never called `xpixi.nest()`
  (HUD, result text) lands on the root scene = fixed screen space. (See `examples/3_games/platformer/`.)

- **Tile-collision AABB tests must treat the max edges as half-open (`Math.ceil(hi/T)-1`), or a body
  resting flush on a tile top reads as overlapping the ground and its horizontal move gets blocked.**
  An entity snapped so its bottom == `row*T` has `floor(bottom/T) == groundRow`; an inclusive range
  then reports the ground as solid during the *horizontal* pass too, freezing sideways motion on flat
  ground. Half-open on the max edge excludes the flush tile; gravity next frame pushes the bottom a
  hair past the boundary so the *vertical* pass still detects landing. (See platformer `World.solid`.)

- **An open-toggle trigger and a document-level `click.outside` closer are a self-close trap: the trigger's
  own click bubbles to `document` and fires `click.outside`, closing what it just opened.** `click.outside`
  attaches on `document` in the BUBBLE phase (`dom.ts`), so the trigger's `unit.on('click')` fires first
  (opens) and then the bubbled document handler fires (closes). Fix: the trigger must
  `event.stopPropagation()` in its click so the opening press never reaches the document closer; genuine
  outside presses (backdrop, elsewhere) don't pass through the trigger, so they still close. Put ONE
  `click.outside` on the menu/overlay (not one per row — N identical document handlers), registered right
  after nesting the menu; a press on a row stays *inside* the menu so `click.outside` skips it and the row's
  own click handles select+close. Its guard must accept `'opening'`, not just `'opened'`: a duration-0 Gate
  is still `'opening'` right after the open (its completion `.timeout` fires at +1ms, not +0), so
  `state === 'opened' || state === 'opening'`. **Tests must dispatch the trigger click with `bubbles: true`**
  — a `bubbles: false` click can't reach the document closer, so it hides this whole class of bug (it hid
  the Listbox self-close until a bubbling repro exposed it). (Bit Listbox when the framed trigger + toggle
  moved from the container into a new `ListboxButton`, so backdrop clicks no longer closed "for free" via the
  container's toggle, 2026-07.)

- **A sync `game.js` (shared by Node server + browser client) must NOT statically import addon/browser-only
  libs (`pixi.js`, `three`, `@mulsense/xnew/addons/*`, `voxelkit`) — Node evaluates the whole module and
  fails to resolve them.** Put the browser libs in a separate browser-only file, and have the client entry
  inject them on a global for the client branches to read — the same flavor as `io: window.io`:
  `index.js` does `import * as gfx from './render.js'; window.gfx = gfx;` before `xsync.boot(Game)` (static
  imports fully resolve first), then `game.js`'s `xsync.client()` blocks use `window.gfx.xpixi` etc. Node
  never runs client branches nor sets the global, so it stays clean. Initialize the addons in the client
  branch of the **sync root** (Game) BEFORE its synced children exist, so `xnew.context(xpixiRoot)` resolves
  for every reconciled replica (context is inherited from the root's end-of-body snapshot). Composite
  Three into Pixi as a bg sprite (`PIXI.Texture.from(xthree.canvas)`, `texture.source.update()` per frame)
  and give scene children explicit `zIndex` + `scene.sortableChildren = true` — replicas mount async, so
  add-order can't be relied on for layering. Addon event callbacks (`pixiObject.on('pointertap', …)`,
  a Three raycast handler, etc.) fire OUTSIDE the tick/scope, so any `xsync.emitToServer` / `xnew.emit` /
  `xnew(...)` inside them must be wrapped in `xnew.scope(...)` (§7) — otherwise `emitToServer` throws
  `no socket bound to this root` (Unit.current isn't the sync node). (See `examples/3_games/card/`.)

- **InputCheckbox holds a Gate for its checked state and its `unit.element` is the CONTAINER, not the
  hidden input (modeled on Listbox, 2026-07).** The `<input>` is nested as a *child unit*
  (`xnew({ tag: 'input', … })`, no `xnew.nest`) so the container stays current — a trailing function
  then composes the mark INTO the box (`xnew(InputCheckbox, {}, (unit) => { … unit.gate … xnew(xicons.Check) })`);
  left empty, a one-tick `xnew.timeout` fallback draws a default check svg (detect "caller composed
  something" by any container child that is not the input). The hidden input gets `z-index: 1` so composed
  marks never steal its clicks. Native `input` bubbles up to the container where `unit.on('input', …)`
  lives → toggles `gate.open()/close()`; `gate.on('-open'/'-closed')` toggles `data-checked` on the
  container (set it once initially from `gate.state`, since the Gate's constructor emits the first `-open`
  before you subscribe). Do NOT assume `unit.element` is the input here — that still holds for InputSwitch,
  but InputCheckbox and InputRange diverged (their `unit.element` is the container; the input is a
  `xnew({ tag: 'input', … })` child, not an `xnew.nest`). InputRange follows the same compose gate:
  its default `InputRangeMeter` + `InputRangeStatus` are drawn only when `xnew.standalone === true`, so a
  trailing compose function replaces them with caller content.

- **A basics component's `frame` ring may be merged INTO the `container` (user decision, 2026-07) —
  the container then carries the border / radius / state tint directly, and there is no separate frame
  part.** InputCheckbox and InputRange did this: the container css gains `border` + `border-radius`
  (add `box-sizing: border-box` so the border stays inside the declared size) and the checked tint keys
  on `&[data-checked]` (self) instead of `[data-checked] > &` (child overlay). Caller `className` / `style`
  now style the ring; the `attributes.frame` part is dropped. Sibling parts (svg / meter / status) still
  react via `[data-checked] > &` since they remain children of the container. (This supersedes the older
  "frame lives on an inner part" guidance in §4 for these components.) InputRange draws its container frame
  as an **inset `box-shadow`** rather than a `border` (user decision, 2026-07): the shadow costs no
  box-model width, so the padding box equals the border box and the absolute meter shares the container's
  coordinate system — the meter pins flush at `0` (no `-1px`) and a full value fills exactly `100%` (no
  `+2px` correction), its leading border landing on the frame ring. A caller drops the frame with
  `style: 'box-shadow: none;'` (not `border: none;`).

- **To split a multi-part basics component, mount each display sub-component on the SHARED container and
  let it listen to the bubbling native event — don't thread a value-setter define across the boundary.**
  InputRange is InputRange (container + hidden input) + two same-file sub-components `InputRangeMeter`
  (the growing meter) and `InputRangeStatus` (the value readout), each mounted with `xnew(…)` and no
  `xnew.nest` so their `unit.element` = the container; each `unit.on('input', …)` catches the input event
  that bubbles up from the later-nested `<input>`. Works because the core reads the value off
  `event.target` (the range input), not the bound element (`dom.ts` `defineEvent(['change','input'])`),
  so an ancestor listener still gets the numeric value. Native `input` events bubble — tests must dispatch
  with `{ bubbles: true }`. These parts are NOT caller-customizable (no `attributes`/`designs` bag —
  user decision, 2026-07); recolor by editing the component, not from the call site.

- **`widget/AnalogStick` and `widget/DPad` make the container itself the `<svg>` (user decision, 2026-07) —
  no wrapping `<div>`, no separate `svg` part, no `attributes` bag.** All shapes are drawn directly
  inside the container svg (viewBox `0 0 64 64`); fill / stroke variants split via inner `<g style="…">`
  groups. Caller `style` lands on the svg and inherits down (`fill` reaches the shapes), so recoloring is
  `style: 'fill: …'` at the call site — no part hook needed. The movable knob shifts in viewBox units via a
  `transform` presentation attribute (travel radius = a quarter of the 64-unit span = 16), not pixel
  left / top on a nested svg.

- **For close-on-outside-press, use the built-in `unit.on('click.outside', …)` — don't hand-roll a
  backdrop `click` listener.** `click.outside` (also `pointerdown/move/up.outside`, `dom.ts`) attaches
  at `document` and fires only when the press target is NOT inside `unit.element` **as of registration
  time** — so register it right after nesting the content box you want to protect. DOM listeners attach
  via `setTimeout(0)`, so the same press that opened the popup can't self-close it. Cleaned up on
  finalize like any listener. `Overlay` deliberately has NO built-in click-to-close (removed 2026-07);
  the caller wires it (see `examples/1_xnew/basics/gate/index.html`).

- **When two sibling components must share a driver unit (e.g. a Gate), create the driver with `xnew(Gate,
  props)` and pass the SAME unit into each — don't rely on `xnew.context` or a merged control surface.**
  A deferred callback runs in the SCOPE SNAPSHOT from when it was scheduled, so `xnew.context(X)` inside it
  cannot see a component extended onto the unit AFTER the callback was scheduled (bit `InputSelectMenu`,
  extended before the `Accordion`). `Accordion` / `Overlay` take `gate: props | unit` — props ⇒ they create
  a child `xnew(Gate, props)`; a unit ⇒ they reuse it — and expose it as `.gate`. A child Gate emits
  `-transition` / `-closed` on its OWN unit, so subscribe on `accordion.gate.on(...)`, not the host unit.
- **The `Unit` class is NOT exposed as a runtime value; `xnew.Unit` is a TYPE only.** To discriminate a
  passed unit from a props object at runtime, use the `xnew.isUnit(x): x is xnew.Unit` type guard (narrows
  like the old `instanceof`) — `x instanceof xnew.Unit` no longer compiles. `xnew.Timer` is likewise a
  type-only alias for the timer object returned by `xnew.timeout` / `interval` / `transition`.

- **A component's body-ending element is where a host's `unit.on(domEvent)` attaches — so any native
  event you want the host to catch must bubble to THAT element.** `unit.on('input', …)` registered after
  a component is extended lands on the unit's *final* element. When InputSelect's body ended on the menu
  (a sibling of the hidden `<select>`), the select's bubbling `input` never reached it and every host
  `unit.on('input')` silently missed. Fix: nest the emitter *inside* the body-ending element (moved the
  `<select>` into the menu) so its event bubbles up to where hosts listen.

- **Anything registered on the shared `io` (server side) must be detached on `finalize` — including
  inside `sync.boot`.** Rooms are created and destroyed continuously, so a dead room that leaves its
  `io.on('connection')` behind grows the namespace's listener count without bound (MaxListenersExceededWarning
  at 10, then unbounded). `bootServer` now keeps the handler in a local and does
  `root.on('finalize', () => io.off('connection', connection))`; any io mock therefore needs an `off`.
  Note the count is legitimately `2 × live rooms` (boot + the caller's own counter), so a server hosting
  many rooms should raise `io.sockets.setMaxListeners(...)` rather than treat the warning as a leak.

- **Every control-like `basics/element` container css starts with the same prelude: `width: …;` then
  the margin-box cap `max-width: -webkit-fill-available; max-width: -moz-available; max-width: stretch;`.**
  `max-width: stretch` caps the *margin box* at the parent so a caller horizontal margin never
  overflows on the right (bit Button; prefixed fallbacks cover Safari / Firefox). Native controls
  need NO `display` / `box-sizing` declarations — the UA already renders `<input>` / `<button>`
  inline-flowing and border-box; a div container declares them itself (`inline-block` / `inline-flex`
  to flow like a control, `box-sizing: border-box` when it carries a border).
  `vertical-align: middle` was deliberately dropped (2026-07, user decision) — don't re-add it.
  Keep the prelude when adding a new element component.

- **Nest the container FIRST — internal wrappers (e.g. Aspect) nest inside it, never outside.**
  The container is the caller-side surface: with Aspect outside, its full-size flex-centering
  wrapper swallowed the caller's `className`, so `absolute left/right` placement always
  rendered centered (bit AnalogStick / DPad).

- **Round `xbasics.Volume`'s `volume` before showing it in UI (e.g. `Math.round(v * 100)` for a
  0–100 InputRange).** The backing `AudioParam` stores float32, so a set of `0.1` reads back as
  `0.10000000149…` — feeding the raw read into InputRange's `value` displays a decimal-laden
  status until the first drag (bit the 3_games VolumeController).

- **Override the SVG-drawn basics' presentation defaults (stroke / fill / …) via css, never via
  svg attributes.** SVG / SVGText and the `xicons` icons take caller `style` / `className` directly (their shell
  IS the `<svg>`; they have no `designs` prop — passing one lands as a junk attribute and does
  nothing). The defaults live in an `@layer base` css rule, and ANY css beats presentation
  attributes — an attribute like `stroke: '#EEE'` passed as a rest member is silently ignored;
  `style: 'stroke: #EEE; stroke-width: 2;'` wins because inline style beats layered css.
  Attribute-only members (`viewBox`, …) still go through rest.

- **A component may forward its rest props into an ElementDef as-is (`xnew.nest({ …, ...others })`)
  without stripping the reserved `key` prop.** If a caller passes `key`, it lands as a harmless
  nonstandard attribute — accepted by design (2026-07); don't add a `key` destructuring just for
  DOM hygiene (see `basics/element/InputText.ts`).

- **A unit created inside a deferred callback (promise `.then`, timer) is NOT visible via
  `xnew.context` to units mounted later with `xnew(parentUnit, ...)` (e.g. `Scene.change`).**
  `Unit.scope` restores the parent's context chain after the callback, and explicit-parent mounts
  use the parent's `lastSnapshot` (end of body) — so create context-provider units in the body
  and fill their data later via a define (bit tohoku_shot's `Assets` holder for baked textures).

- **`xnew(parentUnit, Component)` mounts into the parent's END-OF-BODY element (its `lastSnapshot`),
  so if the body ends on a hidden native control (e.g. a `<select>` nested for form semantics),
  children land inside it — and `<select>.insertAdjacentHTML('<div>')` is silently dropped by the
  parser, leaving `currentElement` undefined and corrupting every later nest.** For popups/overlays
  spawned from a callback, bind an explicit element instead: `xnew(safeElement, Component, props)`
  (bit InputSelect: its dropdown vanished into the hidden select).

- **Don't read the host's `unit.element` inside a callback registered on a child unit that was
  created before a later `xnew.nest(...)` — it sees the nest chain as of that child's creation,
  not the final element.** The callback runs in the child's scope, which snapshots the host's
  current element at creation time (bit InputNumber: the left spin button's click handler got the
  container instead of the later-nested `<input>`, while the right button — created after the
  nest — saw the input). Capture the element into a local after nesting and close over that.

- **An inline component must not implicitly return a unit: write `() => { xnew(Child); }`,
  not `() => xnew(Child)`.** A component's return value is merged as defines, so the returned
  child unit's internals collide and throw `The property "_" already exists.`

- **Don't wrap "apply now + follow an event" in a helper component; write a local `update`
  and reuse it for the initial call and the listener.** Take the initial value as a defaulted
  prop and do `update({ wave }); unit.on('+wave', update);` — a wrapper unit (e.g. the removed
  `FollowWave`) hides the hardcoded initial-value assumption and adds a needless unit. Keeping
  xnew core minimal is preferred over adding sticky/replayed events for this.

- **Anything a component reads must be declared above the module's entry `xnew(...)` call
  (or be a hoisted `function`).** `xnew()` runs component bodies synchronously, so an entry
  call mid-file evaluates the whole component tree during module evaluation — a `const`
  placed later in the file is still in its TDZ and throws
  `can't access lexical declaration '…' before initialization` (bit the 3_games samples
  when a shared `const paleColor` moved from an imported ui.js into the same file).

- **Outside `unit.ts`, read the current unit via `Unit.current`, never the raw `Unit.currentUnit`.**
  The getter lazily bootstraps the engine (root + ticker) on first access, so callers need no
  `Unit.reset()` guard. Inside `unit.ts` (reset / initialize / scope) use only the raw fields —
  reading the getter during `reset()` recurses infinitely before `engineRoot` is assigned.
  (Tests may still read `Unit.currentUnit`: they assert the raw scope-restore behavior.)

- **A `window.keydown.*` game-input handler that calls `preventDefault()` steals those keys
  from every form field on the page** (e.g. WASD became untypable in the multiplay chat).
  Skip the game branch when `event.target` is editable (`input, textarea, select` or
  `isContentEditable`), and send a stop on `window.focusin` into an editable element so a
  held key doesn't keep the player moving.

- **The public barrel exposes four tiers: `xnew` (core) / `xsync` (networking) / `xbasics`
  (networking-free components) / `xicons` (heroicons-based icons, MIT — `src/icons/license.txt`),
  all from `@mulsense/xnew`; addons stay on `/addons/*` subpaths.**
  The networking layer is a single file `src/sync/xsync.ts` (shared state + boot + facade). `xsync`
  **is** the facade object literal (`export const xsync = { … }`) — there is no Lobby / Room component
  built in; lobby / room lifecycle is assembled by callers from the facade (see `examples/*/server.js` +
  `index.js`). Export the literal directly — **never `Object.assign` the facade onto a fresh object**,
  which invokes the `session` getter at module load (no current unit → throws).

- **Custom sync-event handlers get `{ id, ...data }`, but `id` (sender socket id) is set
  only on the SERVER dispatch; on the CLIENT it is `undefined`.** So for a room-wide
  (`+`-broadcast or no-prefix) event whose server broadcast must tell clients who sent it, put
  the sender id into the relayed `data` server-side — don't rely on the injected `id` reaching clients.
  (A room chat: client `sync.emit('+chat',{text})` → server `unit.on('+chat',({id,text})=>…)` has
  the real `id`; it must re-emit `{ id, text }` so each client's `{ id: undefined, ...data }`
  recovers the sender via the spread shadowing the undefined.)

- **Addons are NAMED exports (`export const xmatter/xpixi/xthree`), not default.**
  Import as `import { xmatter } from '@mulsense/xnew/addons/xmatter'`, or for a
  conditional dynamic import read the named key:
  `(await import('.../xmatter')).xmatter` — **not** `.default` (which is `undefined`
  and throws `Cannot read properties of undefined`). Bit the multiplay example whose
  server-side `xmatter.initialize()` crashed on room boot, surfacing as the client
  immediately showing "切断". (`matter-js`/`voxelkit` *do* default-export — per-package.)

- **`captureStateTree(clientId)` runs once per connected client (per-client projection, 2026-07).**
  The server no longer broadcasts one `'sync'` tree to the room; it loops `info.clients` and emits
  `io.to(client.id).emit('sync', captureStateTree(client.id))`. Consequence for tests: a capture-only
  test that boots the server and reads `hub.lastSync()` must **connect a client first** (`hub.connect()`),
  or nothing is emitted (empty `info.clients` → no `'sync'`). `io-mock` records the target of each
  `'sync'` — use `hub.lastSyncFor(clientId)` to read one client's projection.
- **`captureStateTree` / `applyStateTree` are boot-internal (not exported).** Capture lives
  in boot's server branch (closes over `root` + a local `nextId`), apply in the client branch
  (closes over `root` + a local `reconcileMap`). The only seams are: server emits `'sync'` on
  `root.on('update')`, client applies on `socket.on('sync')`. To drive them in tests, go through
  boot's wiring — `io-mock` records emitted `'sync'` trees (`hub.lastSync()`) and the mock client
  socket has `fire(event, payload)` to inject a down-event (e.g. a hand-built tree) in client env.
  Never re-add a direct `import { captureStateTree, applyStateTree }`.
- **Capture runs after children update.** `Unit.update` recurses children *then* runs the unit's
  own update systems, so boot's `root.on('update')` capture sees this tick's child mutations. A
  single `asServer(() => Unit.update(server))` both advances server logic and broadcasts state.
- **`sync.boot` (client) owns the socket — don't create it in callers.** Pass
  `{ io, client, room }` (`client` is `{ name }`); boot does
  `io({ query: { roomId: room.id, clientName: client?.name ?? '' }, forceNew: true })`
  and the server reads `query.roomId` / `query.clientName`. Keep the query **flat
  strings** (socket.io stringifies query values, so a nested object would arrive as
  `[object Object]`). boot also forwards `connect`/`disconnect`/`notfound` to the boot
  **parent** as `-events`. When you change a query key, update every reader in one pass:
  boot's connection handler **and** the examples' Lobby/Room server blocks (`examples/*/server.js`)
  **and** the test mocks (`io-mock.ts`).
  The forward reaches up to the parent (the boot root is a *child* of the host), so it
  bypasses the root-scoped `dispatch` on purpose — host listeners live above the root.
- **When changing `BootServerOptions`/`BootClientOptions`, update the test `bootClient`
  adapter in `test/core/sync/io-mock.ts` too.** It wraps a pre-made mock socket as
  `io: () => socket` so the ~25 call sites stay unchanged; miss it and every sync test
  throws `io is not a function`. Tests in `boot-api`/`channel` also *document* the
  boot contract — update those assertions when the contract changes.
- **When renaming a socket/wire event, update every endpoint in one pass:** the
  server `emit`, the client `on` (and the `-event` it forwards to if that changes),
  the tests that fire/expect it, and the examples that subscribe. Missing one half
  silently breaks the protocol (no compile error — strings).
- **Keep an exposed define's shape stable across all its callers.** A getter that
  changed from returning a `Map` to returning an array broke a caller doing
  `.delete(...)`; because the value crossed a unit boundary as `any`, TypeScript
  did not catch it. If two callers need different shapes, expose two members
  (e.g. a `rooms` list getter + a `remove(id)` method).
- **Defines must be functions/getters/setters, not plain values** (see §2) —
  returning `{ x: 1 }` throws at runtime.
- **A comment line that begins with `// @ts-expect-error` is treated as a real
  directive** by TypeScript, even inside a block comment. Reword so the marker is
  not at the start of a line (e.g. "asserted with a ts-expect-error directive").
- **Index signature ≠ typed.** `unit.someDefine()` compiles even when misspelled;
  do not rely on the compiler to catch unit-member typos (see §12).
