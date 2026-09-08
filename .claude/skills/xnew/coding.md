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
- Lifecycle phases: `invoked → active → destroying → destroyed`.
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
- There is **no trailing extension component** (`xnew(Base, props, fn)` was removed 2026-08):
  the third argument is ignored. To compose onto a component, wrap it —
  `xnew((unit) => { xnew.extend(Base, props); … })`: `Base` is extended first, then the body
  runs on the same unit, and defines from both merge onto it.
- **Init-only helpers** (throw if called after `invoked`, i.e. outside the
  synchronous body or in a later callback): `xnew.nest`, `xnew.extend`,
  `sync.server`, `sync.client`, `sync.register`, `sync.state`.

## 4. DOM: element, nest, events

- `unit.current` is the unit's current DOM element — it walks inward with every `xnew.nest`.
- `unit.container` is the unit's **own outermost** element — its first nested element, or **`null`** when it
  nested none and merely borrows the element it was created on. Use it when a caller needs the whole
  component's box; `current` is the innermost part. Note `container` is a `Unit` member, so a component
  define named `container` throws.
- `xnew.css((layer,) { name: def… })` registers pseudo-scoped CSS with **mandatory
  scoping**: every key is a local name, always renamed to a page-unique one, and keys must
  match `[A-Za-z][A-Za-z0-9_-]*` (anything else throws) — there is no way to emit a global
  rule (a body whose braces escape or don't balance throws). A **string** value is a class
  **declaration body**, wrapped as `.xnewN-key { … }` (native CSS nesting works inside:
  `&:hover`, `&[data-checked]`, descendant selectors — and `@media` / `@supports` /
  `@container` nest here, which is THE way to write responsive rules). An **at-rule** value
  declares its kind as `{ rule, body }` with
  `rule: '@keyframes' | '@property' | '@counter-style' | '@font-face'`, hanging the generated
  name on it — `turn: { rule: '@keyframes', body: 'from {…} to {…}' }` emits
  `@keyframes xnewN-turn { … }`; `'@property'` names become `--xnewN-key` (so `var($key)` is
  correct as-is); `'@font-face'` injects the name as the `font-family` descriptor and its
  `body` may be an **array** of faces (weights / unicode-ranges) — an array anywhere else
  throws, and a string body starting with a definition at-rule throws (write it as
  `{ rule, body }`). `$key` inside a body references another entry's generated name —
  `animation: $turn 0.8s linear infinite;` — and an unknown `$key` throws (a letter must
  follow `$`, so `[href$=".png"]` is untouched; `$words` inside strings / comments pass
  through unrenamed). An **optional `layer` string first argument**
  wraps the whole block in `@layer` (invalid layer throws). The return value maps each key to
  its generated name (typed via `keyof`) to embed in tag strings
  (`xnew.nest(`<div class="${css.name}">`)`). Identical definitions share one ref-counted
  `<style>`, removed when the last user unit is destroyed; on the server (no DOM) keys map to
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
  **`...others` always lands on the component's LEADING element (2026-09):** the container for
  single-element ones (Button, Image, Listbox, InputRadioGroup, ColorPicker, Accordion, Overlay), the
  hidden native `<input>` for the form controls (InputText / InputNumber / InputRange / InputCheckbox /
  InputSwitch / InputRadio), the inner `<text>` for SVGText — `min` / `placeholder` / `fontSize` only
  mean anything there. `className` / `style` are the exception in the other direction: they always
  decorate the container, so they and `others` deliberately land on different elements.
  **A `.value` set announces on that same leading element (2026-09)** — the hidden input where there is
  one, the container where there is none — which is exactly where a user's own interaction fires, so a
  host reading `event.target` cannot tell a programmatic write from a real one (`valueevent.test.ts` holds
  that table). InputCheckbox / InputSwitch were the last exception: they announced on the container to keep
  the setter's event out of their own input listener, and once the Gate went away that listener became a
  plain idempotent `apply`, so the exception went too. Announcing on the inner element is also what lets a
  wrapper swallow a part's notification and re-announce it as its own (InputRadioGroup does this to its
  segments, as Listbox does to its rows).
  **`disabled` is the one prop that must reach BOTH**, and is therefore taken explicitly rather than
  left to `others`: the container gets `data-disabled` (dimmed through one shared rule,
  `&[data-disabled] { opacity: 0.5; cursor: default; pointer-events: none; }`, in every component's
  container css) and any focusable native child gets the real `disabled` — `pointer-events: none` alone
  still lets Tab reach it. A grouping component passes its own `disabled` down (InputRadioGroup exposes
  it as a define for the segments to read). `test/basics/element/disabled.test.ts` holds the whole
  convention table; components with no notion of disabled (Image / SVGText) are out of it.
  Multi-part form components (InputCheckbox / InputRadio /
  InputRange / InputSwitch / Listbox) carry the framed look (border / radius / state tints) ON the
  container itself (frame merged in, 2026-07). State attributes (`data-checked` / `data-open`) toggle on the container; inner
  parts (knob / meter / status / mark) react via parent-keyed rules (`[data-checked] > & { … }`).
  No component exposes a `container` define (it would collide with the `unit.container` member); for
  InputCheckbox / InputRange / InputSwitch `unit.current` IS the container (input / knob / meter are
  children) — for the others it ends on the innermost nested part, so read `unit.container` (or capture
  the element right after nesting it) when the component needs it later.
- **Basics components expose NO part-customization bag** (no `attributes` / `designs` prop — all
  removed 2026-07). A caller restyles only via `className` / `style` on the container, which reaches
  inner parts through inheritance — the frame border, the knob / meter background, and the state tint
  all key on `currentColor`, so a single `className: 'text-indigo-600'` recolors the whole control
  cohesively. For structural change, InputCheckbox / InputRange / InputSwitch let a caller replace
  their default inner content — the mark, the meter + status, the knob respectively — by extending
  them onto an outer component (`xnew(() => { xnew.extend(InputRange, props); … })`, gated on
  `xnew.standalone(() => …)`). Generated
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
  element, bind it at unit creation instead: `xnew(element, Component)` (`xsync.boot`
  takes no target — wrap it: `xnew(element, () => xsync.boot(opts, Component))`). `xnew.extend(Base)`
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
  When a unit is destroyed, its listeners registered on *other* units are detached
  automatically (no stale cross-unit residue).

## 5. Lifecycle events

- `unit.on('update' | 'destroy', cb)`. There is **no** `start`/`stop`/`render`
  event — a unit begins ticking (`update`) as soon as it is `active` and stops
  only on `destroy` (no pause/resume state, no separate render pass). Lifecycle is
  `invoked → active → destroying → destroyed`.
- `update` callbacks receive `{ count, delta }` (`delta` = ms since last frame;
  `count` starts at 0 per listener). `destroy` gets `{ type }`.
- **Do all teardown in `'destroy'`**: remove external listeners, disconnect
  sockets, clear non-xnew timers. Children are destroyed before parents, in reverse.

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
  destroy) and run their callback in scope.
- timeout/interval callbacks get `{ count }` (iteration count from 0); transition
  gets `{ value }` (0→1). Cancel with `clear()` on the returned timer. Prefer these
  over `setTimeout`/`setInterval` for anything tied to a unit's lifetime.

## 9. Context & find

- `xnew.context(Component)` → the nearest ancestor unit created/extended with that
  component (its exposed defines are accessible). **Returns `any`** — no type
  checking, so a typo or wrong shape will not be caught at compile time.
- `xnew.find(Component, { key })` → array of matching units (respects `protect`).
- Every `find` option is an independent condition on the **found** unit, so any combination
  is valid (they AND together): `key`, `ancestor` (that unit is among its ancestors — i.e.
  descendants at any depth, the ancestor itself excluded), `parent` (its direct parent).
  There is no `root` option anymore (renamed to `ancestor`, 2026-09).
- `key` is a **reserved prop** used by `find(..., { key })`; assume it is globally
  unique.

## 10. Scene navigation (`xbasics.Scene`)

- **Scene is the navigator; the mounted unit itself is the navigation state.**
  A scene component does `xnew.extend(xbasics.Scene)` to get:
  `unit.change(Component, props?)` — mount the next scene under `unit.parent` and
  destroy this one (swappable scenes must share a parent container); and
  `unit.add(Component, props)` — child under the scene unit, destroyed together
  with it (returns the unit). Navigation is **by component** only — there is no
  label form and no SceneList lookup table (both removed 2026-07). From a
  descendant, use `xnew.context(xbasics.Scene).change/add(...)`. Scenes are
  recreated from props; they do not preserve state across moves.
- **`change` only swaps units** — mount next, destroy self, nothing else. There is no
  `leave()` protocol and no re-entry guard (both removed 2026-09). **Transitions, in and
  out, are the caller's job:** entrance effects go in the component body, exit effects run
  before the swap —
  `xnew.transition(fade, 400).timeout(() => unit.change(Next))` — and the caller
  guards its own re-entry (a flag) if the trigger can fire twice.

## 11. sync — multiplayer (server ↔ client)

- `sync.server(cb)` / `sync.client(cb)` run `cb` **only** in that runtime
  (Node = server, browser = client; auto-detected). They behave like `extend`: the
  object `cb` returns becomes defines on the unit. They are init-only.
- A component mounted on both sides reads a **different prop shape** per side.
  Split the props into explicit types and cast inside each block, e.g.
  `RoomServerProps` / `RoomClientProps`, then
  `const { io } = props as RoomServerProps;`.
- `sync.boot({ io, room }, Component, props?)` (server) / `sync.boot({ io, client, room }, Component, props?)`
  (client) creates a synced root. **One** root component only — no target, no second
  component; compose with `xnew.extend` inside it. On the **client** side boot calls `io(...)` to
  create **and own** the socket, with a **flat string** handshake query
  (`io({ query: { roomId: room.id, clientName: client?.name ?? '' }, forceNew: true })`),
  and disconnects it on destroy. Callers (e.g. an example's `Room` component) just boot —
  they no longer touch the socket. `sync.state`, `sync.register` and `sync.emit`
  operate on the current sync root.
- **Lifecycle events are `sync.connect` / `sync.disconnect` / `sync.notfound`, dispatched into
  the root on BOTH sides** (the `-connect`-style boot-parent forwards were removed 2026-07). Every
  handler gets `{ id }` = the affected client's socket id; compare with `xsync.session.myself.id`
  to tell self from others. Self events come from the own socket; other members' connect/disconnect
  are relayed by the server (`socket.to(room)`, sender excluded — no double fire). `sync.notfound`
  is own-boot-failure only. Listeners must live **inside** the boot root — pass a component that
  extends the game onto it: `xsync.boot(opts, (u) => { xnew.extend(Game); u.on('sync.connect', …); })`.
- Socket handlers run outside the tick → wrap them in `xnew.scope` (§7).
- **Wire event names vs host event names are independent.** A socket/wire event
  (`'roomcreated'`) and the host-facing unit event it is forwarded to
  (`'-roomcreated'`) are separate strings; keep their mapping deliberate.
- **Send events with the single `sync.emit(type, props, clients?)` (the old
  `emitToServer` / `emitToClients` pair was merged into it).** Receive with
  `unit.on(type, ({ id, ...props }) => …)` (`id` = sender socket id).
  - `clients` omitted = one hop: from a **client** it fires `type` on the **server**
    (a `'-type'` is scoped to the server unit sharing the sender's `syncId`); from the
    **server** it fires on every client in the room (`id` = `undefined`). This is the
    built-in room broadcast — don't hand-roll a relay component.
  - `clients` = a `ClientStatus` or `ClientStatus[]` (from `sync.session.clients`) →
    delivered to exactly those clients, always **via the server**: a client's targeted
    send is relayed, and the server keeps only targets in its own room roster. `[]`
    reaches nobody.
  - On the server `sync.emit` always goes to the wire — for a local fire use `xnew.emit`
    (`'+'`/`'-'` only).
  - The wire events `emitToServer` / `emitToClients` (written inline — no WIRE_* consts)
    are reserved — don't use them as app `type`s.
- **Per-client state projection — `sync.visibility(predicate)`.** The server captures the sync tree
  **once per connected client** and emits each socket its own projection. By default a node is
  **public** (reaches every client). `sync.visibility((clientId) => boolean | null)` (predicate or
  null ONLY — the old id/list forms were removed with the `visibleTo` rename, 2026-07) restricts the
  **current** sync node — **and its whole subtree**, since hidden children would lose their parent
  link — to the clients the predicate accepts; `null` makes it public again. Declare it in the
  component's `sync.server` block so private state (hands, roles) **never reaches the wire** for
  excluded clients — hiding on the client is not secure (DevTools sees the payload). The predicate is
  **re-evaluated every capture**, so close over a flag (`revealed`) and flip it for a dynamic reveal —
  no re-call needed. Typical shape: one `PlayerView` per client,
  `sync.visibility((clientId) => clientId === ownerId)`, spawned on `sync.connect` and removed on
  `sync.disconnect` (see `examples/1_xnew/sync/hidden-info/`).
- **Change signal — `'sync.update'` (client-side, 2026-08).** The server emits `'sync'` to a client
  only when that client's projection actually changed (per-client JSON cache, cleared on disconnect);
  the client boot dispatches `'sync.update'` into the root after reconciling an arriving tree — so it
  fires exactly once per applied change, with the state already applied, and reaches replicas created
  by that same frame. Use it for redraw-on-change instead of per-tick `JSON.stringify` key diffing:
  set a `dirty` flag in `unit.on('sync.update', …)` (and at local UI-state mutations) and rebuild in
  `unit.on('update')` when dirty — rebuilding inside the tick avoids destroying pixi objects
  mid-event-dispatch (see `examples/3_games/cat_king/`). Server side has no such event (its state
  changes are its own writes). Per-frame streaming state (physics positions) still reads the state
  object in `on('update')` — `sync.update` is for rebuild-style UI, not per-frame follow.

## 12. TypeScript notes

- `Unit` has an index signature `[key: string]: any`, so **every member access
  (`unit.foo`) compiles and resolves to `any` — it is NOT a typo check.**
  This is the price of runtime-attached defines — rely on local typed
  closures for your own state.
- **Defines are not typed at all.** `xnew(Component)` returns a plain `Unit` and
  `xnew.extend(Component)` returns `Record<string, any>`. Tracking runtime-attached
  members statically was given up on, so `xnew(Comp).anyDefine` is `any` — declared
  in the component's return or not.
- **Props stay typed** (`PropsOf` / `PropsArg`): `xnew(Comp, props)` type-checks the props
  object, and the props argument is **required** unless every prop is optional — so
  `xnew(Comp)` on a component that needs props is a compile error, not a runtime one.
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

- **Every value-bearing `basics/element` component exposes its state as a `.value` get/set define whose
  type mirrors its own `value` prop — `.input` stays only as an escape hatch to the raw element, and is
  never the write path (2026-09).** Writing through `.input` skips the component's own bookkeeping and
  silently desyncs it: `input.value = 50` on InputRange left the meter / status stale (a plain assignment
  fires no `input` event), and `input.checked = true` on InputCheckbox / InputSwitch left `data-checked`
  and the composed mark disagreeing with the input. The `.value` setters route through the
  right channel instead — InputRange refires a bubbling `input` (so the parts follow, and host listeners
  hear a programmatic set too — deliberate, since the shared container IS the internal bus), and
  InputCheckbox / InputSwitch run one `apply` (input + `data-checked` together) before announcing. A
  numeric setter also **confines its argument and announces what the element actually stored** (2026-09):
  InputRange clamps to `min` / `max` then re-reads `valueAsNumber` (so the step snap rides along),
  InputNumber clamps against the `min` / `max` attributes (a native number field keeps an out-of-range
  assignment, it only marks itself invalid) — listeners and `.value` can never disagree. Types follow each component's own
  `value` prop, NOT one blanket type: string (InputText), number (InputNumber / InputRange, `valueAsNumber`,
  so NaN on an empty field), boolean (InputCheckbox / InputSwitch), hex string (ColorPicker), selected
  item (Listbox). Two deliberate exceptions: **InputRadio's `.value` is read-only** (a segment's value is
  its identity, fixed at creation — its mutable state is `.checked` get/set, and there is no group-level
  value getter — `InputRadioGroup` is that layer (2026-09): it owns the frame, generates the shared `name`
  when none is given (an empty `name` groups nothing in HTML, so a forgotten one silently broke exclusivity),
  and its `.value` is the pick. A grouped segment stops its own value events and hands the pick to
  `group.value`, exactly as a ListboxItem hands its press to the Listbox; alone, a segment still announces
  for itself). Its value events carry the **chosen value string**, never the boolean, and `.checked = false`
  announces nothing — a native radio behaves exactly so (2026-09). `.check(current)` is the silent setter
  the group writes through, named as on ListboxItem.

- **When a component's setter can express everything a `select()`-style action method did, drop the method —
  one write path, not two (2026-09).** Listbox's `select(value)` define had exactly one caller (ListboxItem's
  click) and did `apply` + `xnew.emit('-change')` + `gate.close()`; that IS the setter now, and the row
  press writes `listbox.value = value` like any host would. Panel's `Tabs.select()` went the same way: the
  tab press and a host assignment both run one local `select` behind the setter, and the define is gone
  (its one outside caller, xnew-gamelab's panel, moved to `tabs.value = …`). Consequence to keep in mind:
  **the Listbox and Tabs `.value` setters announce** — Listbox's also closes the menu — so a host mirroring
  `change` back into `.value` recurses; guard it. Listbox's deferred default adoption stays silent by
  calling the internal `apply` directly, never the setter. ColorPicker and Panel's Color row are the
  remaining silent setters (they have no action method to fold in, so folding would be a pure behavior
  change) — that split is unresolved, not a rule.

- **A control built out of plain elements reports edits with a real bubbling DOM `change`, not a custom
  `-change` — `dispatchChange(element, value)` from `utils/dom` (2026-09).** The custom event was the last
  thing keeping Listbox / ColorPicker / Panel's rows from being read like an `<input>`: a host had to know
  which controls were native (`on('input')` / `on('change')`) and which were not (`on('-change')`). Now
  every basics control answers to `unit.on('change', ({ value }) => …)`. The value rides in
  `CustomEvent.detail.value` because these have no form control to read it off, and `utils/dom`'s
  change / input factory prefers `detail.value` when present — which is also what lets an ANCESTOR listener
  read it (one `panel.on('change')` covers every row). Consequences: it BUBBLES, unlike `-change`, so a
  wrapper that must not leak a nested control's event stops propagation in its own handler and re-fires its
  own — ColorPicker already did this for its hex / RGB fields, and Panel's Color row now does it for the
  picker in its popup. Dispatching needs no `xnew.scope`: capture the element right after `xnew.nest`
  and the notifier works from any scope (that removed two `xnew.scope` wrappers).

- **The `input` / `change` split follows the native pair exactly: `input` every time the value moves,
  `change` once it settles, and BOTH — input first — for an edit that commits in one step (2026-09).**
  `utils/dom` exports the three matching helpers: `dispatchInput` / `dispatchChange` / `dispatchCommit`.
  So ColorPicker streams `input` while a bar is dragged and fires `change` on `dragend`; a preset click, a
  typed field and a Listbox / Tabs selection are one-step commits and fire both; **and every `.value`
  setter across basics fires the pair**, so a programmatic set is indistinguishable from a user edit. Two
  traps this creates: (1) a control's own native sub-inputs now leak BOTH events, so a wrapper must stop
  both — ColorPicker stops `input` as well as `change` on its hex / RGB fields, since half-typed text is
  not a color; (2) dispatching an `input` that the component itself listens for re-enters its own handler.
  InputCheckbox / InputSwitch hit this: their Gate driver moved from `unit.on('input')` (the container) to
  `input.on('input')` (the hidden input) so the setter, which dispatches on the container, cannot drive the
  Gate twice — `Gate.move` is NOT idempotent once a transition has finished (`moving` is back to 0, so a
  second `open()` re-emits `-open` / `-opened`). Those setters also flip `input.checked` up front, because
  the Gate only reports a close after its transition, and `.value` must read true immediately.

- **A default that a component can compute from its own props must be applied synchronously in the body,
  not in a deferred `xnew.timeout` — a caller reads `.value` right after `xnew(...)`, not a tick later
  (2026-09).** `xnew(Listbox, { items })` left `.value === ''` for one tick because Listbox only
  adopted the first item after every ListboxItem had registered itself. `items` is right there in the
  standalone path, so `Listbox` now resolves `value ?? itemDef(items[0]).value` before extending the state;
  the deferred adoption stays for the composed path, where the caller builds the rows and the component
  genuinely cannot know them up front. Panel's `listbox()` builder resolves the same default for its own
  path (it hand-builds the rows, so Listbox sees no `items`) — keep both.

- **`xnew.standalone` is a FUNCTION, not a boolean: `xnew.standalone(() => { … })` (2026-09).** It defers
  the callback to just after this component's defines land on the unit, and runs it only when the component
  is used on its own (not extended onto another); it is init-only and throws afterwards. The deferral is the
  point: a component that draws its own default UI usually has parts that read the host's defines through
  `xnew.context` (Listbox's ListboxButton / ListboxMenu / ListboxItem call `.bind` / `.register` / `.gate`
  in their own bodies — `.bind` / `.register` take the part's UNIT, and drop it again on its `destroy`), and defines attach only once the component returns (§2) — a plain
  `if (xnew.standalone === true)` block in the body ran too early and got `undefined`. Listbox used to work
  around this with a separate `ListboxState` component extended first; both that and the workaround are
  gone. Each `Unit.extend` invocation keeps its own queue, drained with an index loop so a callback may
  defer another, and the invocation's `currentComponent` / `standalone` are restored only after the drain —
  so an `xnew.extend` from inside a callback still sees itself as nested, exactly as it would in the body.
  There is no way to READ standalone-ness any more; if you need a value from it, compute it in the callback.

- **Keep a component NAMED only when something resolves it — `xnew.context` / `xnew.find` / an export.**
  A helper that exists purely to hold state or defines belongs in its host's body as plain closures.
  `ListboxState` was neither a context key (the parts resolve `xnew.context(Listbox)`, the outer component)
  nor exported, so it was deleted and its state inlined into Listbox.

- **A Panel row that owns its control as a CHILD unit must re-expose `.value` as a delegating define —
  extending the control onto the row instead would flip `xnew.standalone` to false and silently drop the
  control's default inner parts (2026-09).** `panel.range()` / `panel.checkbox()` had no `.value` at all
  while `panel.color()` / `panel.listbox()` did, because the first two do `xnew(InputRange, …)` (a child)
  and the last builds via `xnew.extend(Listbox, …)`. The fix is `const range = xnew(InputRange, …); return
  { get value() { return range.value; }, set value(v) { range.value = v; } }` — NOT an extend, which would
  cost InputRange its meter / status and InputCheckbox its mark. Tabs' `active` getter became `.value`
  (get/set) in the same pass, so every value-bearing row answers to one name.

- **Never let a `+event` listener mount a unit that itself listens for that same `+event` (e.g.
  `unit.on('+x', () => unit.change(Next))` where `Next` registers `'+x'` too) — put the ONE listener on a
  stable ancestor instead.** `Unit.emit` iterates `type2units` live, so a unit added during the emit also
  receives it: the freshly mounted scene changes again, mounting another, forever (page freeze, no error).
  Pattern: the parent listens once and drives the swap via `xnew.find(xbasics.Scene)[0].change(...)`
  (bit the stage example when every scene variant subscribed to `'+screen'`).

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
  a Three raycast handler, etc.) fire OUTSIDE the tick/scope, so any `xsync.emit` / `xnew.emit` /
  `xnew(...)` inside them must be wrapped in `xnew.scope(...)` (§7) — otherwise `xsync.emit` throws
  `no socket bound to this root` (Unit.currentUnit isn't the sync node).

- **InputCheckbox's `unit.current` is the CONTAINER, not the hidden input (modeled on Listbox, 2026-07).**
  The `<input>` is nested as a *child unit*
  (`xnew({ tag: 'input', … })`, no `xnew.nest`) so the container stays current — an outer component
  then composes the mark INTO the box (`xnew(() => { xnew.extend(InputCheckbox); … xnew(xicons.Check, { className: css.mark }) })`,
  the mark styling itself off `[data-checked] > &`);
  left empty, a one-tick `xnew.timeout` fallback draws a default check svg (detect "caller composed
  something" by any container child that is not the input). The hidden input gets `z-index: 1` so composed
  marks never steal its clicks. **InputCheckbox / InputSwitch hold NO Gate (2026-09):** the hidden input's
  own `input` event drives one `apply` that flips the input and toggles `data-checked` on the container,
  and every transition is CSS on the composed mark / knob — there is no `gate` prop and no `.gate` define
  (the Gate only ever ran at duration 0 here, and its props merged badly with `value`). Do NOT assume `unit.current` is the input here — that still holds for InputSwitch,
  but InputCheckbox and InputRange diverged (their `unit.current` is the container; the input is a
  `xnew({ tag: 'input', … })` child, not an `xnew.nest`). InputRange follows the same compose gate:
  its default `InputRangeMeter` + `InputRangeStatus` are drawn only inside `xnew.standalone(() => …)`, so
  extending it onto an outer component replaces them with caller content.

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
  `xnew.nest` so their `unit.current` = the container; each `unit.on('input', …)` catches the input event
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
  at `document` and fires only when the press target is NOT inside `unit.current` **as of registration
  time** — so register it right after nesting the content box you want to protect. DOM listeners attach
  via `setTimeout(0)`, so the same press that opened the popup can't self-close it. Cleaned up on
  destroy like any listener. `Overlay` deliberately has NO built-in click-to-close (removed 2026-07);
  the caller wires it (see `examples/1_xnew/basics/gate/index.html`).

- **When two sibling components must share a driver unit (e.g. a Gate), create the driver with `xnew(Gate,
  props)` and pass the SAME unit into each — don't rely on `xnew.context` or a merged control surface.**
  A deferred callback runs in the SCOPE SNAPSHOT from when it was scheduled, so `xnew.context(X)` inside it
  cannot see a component extended onto the unit AFTER the callback was scheduled (bit `InputSelectMenu`,
  extended before the `Accordion`). `Accordion` / `Overlay` take `gate: props | unit` — props ⇒ they create
  a child `xnew(Gate, props)`; a unit ⇒ they reuse it — and expose it as `.gate`. **Listbox does NOT (2026-09):**
  it takes plain `duration` / `easing` and OWNS the Gate it builds (still exposed as `.gate`, which is what
  ListboxButton / ListboxMenu / an outer Accordion ride), so nothing outside can hand it a contradictory `open`. A child Gate emits
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

- **Anything registered on the shared `io` (server side) must be detached on `destroy` — including
  inside `sync.boot`.** Rooms are created and destroyed continuously, so a dead room that leaves its
  `io.on('connection')` behind grows the namespace's listener count without bound (MaxListenersExceededWarning
  at 10, then unbounded). `roomio.on(type, listener)` handles this for every wire subscription (it detaches
  on root destroy), so boot never calls `io.on` / `socket.on` directly — and **every io / socket mock or
  stub therefore needs an `off`** (`io-mock`'s client socket and the hand-rolled socket in `channel.test` both have one).
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

- **Round `xaudio.volume` before showing it in UI (e.g. `Math.round(v * 100)` for a
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

- **Don't read the host's `unit.current` inside a callback registered on a child unit that was
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

- **The current unit is `Unit.currentUnit` everywhere — there is no `Unit.current` getter (2026-09).**
  The engine (root + ticker) boots from a `static { Unit.reset(); }` block in the `Unit` class body, so
  the field is never undefined and no caller needs a lazy guard. Keep the boot inside the class: a bare
  `Unit.reset()` at module scope is droppable by a bundler because `package.json` declares
  `"sideEffects": false`. Because the root ticker now starts at import time, it is built with
  `new Ticker(cb, 60, true)` — the `unref` flag, so merely importing xnew cannot keep a Node process
  alive. User-facing timers stay ref'd, so a pending `xnew.timeout` still fires in Node.

- **A `window.keydown.*` game-input handler that calls `preventDefault()` steals those keys
  from every form field on the page** (e.g. WASD became untypable in the multiplay chat).
  Skip the game branch when `event.target` is editable (`input, textarea, select` or
  `isContentEditable`), and send a stop on `window.focusin` into an editable element so a
  held key doesn't keep the player moving.

- **The public barrel exposes six tiers: `xnew` (core) / `xsync` (networking) / `xaudio` (audio) /
  `xbasics` (UI components) / `xicons` (heroicons-based icons, MIT — `src/icons/license.txt`) /
  `xtextures` (procedural textures), all from `@mulsense/xnew`; addons stay on `/addons/*` subpaths.**
  `xaudio` (src/audio/) is a facade like `xsync`: `load` / `synthesizer` return plain xnew-free
  `AudioTrack` / `Synthesizer` class instances whose teardown `clear()` (load also registers
  `xnew.promise`) is wired to a unit under the current scope inside the facade; `volume` is a
  getter/setter on the shared master gain. There are no `xbasics.AudioTrack` / `Synthesizer` /
  `Volume` members anymore (moved 2026-07); the only basics → xaudio dependency is
  `VolumeController`, which reads/writes `xaudio.volume` directly.
  **`xtextures` entries are plain texture objects, NOT component functions** (lowercase members:
  `xtextures.wood`): the fields `name`/`glsl`/`ranges`/`presets` plus the flows. There are **NO
  `.color`/`.normal` members** — both channels live as entry functions inside `glsl`, so a stale
  `texture[channel] !== undefined` check silently yields zero views (bit the 1_xnew/textures viewer).
  A texture module authors only `{ name, glsl, ranges, presets }` (TextureSource; `name` =
  lowercase member key). **`presets.standard` is the authority on uniform keys and types** (scalar →
  float, `[r,g,b]` → vec3; it feeds `uniformDeclarations`); other presets partially override it;
  `ranges` holds `{ min, max }` for every scalar key (no `step` — InputRange auto-computes it). The
  entry-fn names `xtex<Name>Color` / `xtex<Name>Normal` are derived from `name`; `defineTexture` is
  check-free — schema / glsl consistency is asserted by the tests, and only invalid uniform keys
  throw at assembly (`uniformDeclarations`). Flows —
  `bake(options)` → ImageBitmap on ONE shared OffscreenCanvas (never one WebGL context per texture:
  browsers cap contexts), `renderer(canvas, options)` for a caller-owned live-preview canvas (caller
  wires `unit.on('destroy', () => renderer.dispose())`), and passing the object to
  `xthree.material(texture, options)` — ONE entry point (unified 2026-09-08; there are no
  `.shader` / `.standard` members any more, and no separate `xthree.bake` — removed 2026-07-24).
  `options.type` picks the path: `'bake'` (**the default** — bakes color / normal internally →
  MeshStandardMaterial), `'shader'` (ShaderMaterial injection, fake fixed light, scene lights /
  shadows do NOT apply) or `'inject'` (patches the GLSL into the standard shader via
  onBeforeCompile — full PBR + live `material.uniforms`, but the one three-chunk-dependent spot).
  The texture parameters live in `options.params` (never mix `type` into `params` — that bag is
  uniform keys); `'bake'` also takes `size` / `worldSize` / `tile` / `repeat`, and `'bake'` /
  `'inject'` hand every other key to MeshStandardMaterial. Only `texture` is REQUIRED —
  `xthree.material(xtextures.wood)` is a valid baked material. The three overloads return
  ShaderMaterial / MeshStandardMaterial / MeshStandardMaterial & { uniforms } respectively, so
  `uniforms` does not typecheck on a baked one. Method comparison lives in
  docs/xtextures-three-materials.md. Don't re-wrap textures as xnew components.
  The networking layer is `src/sync/xsync.ts` (shared state + boot + facade) plus `src/sync/roomio.ts`
  (`RoomIO`: holds the root unit, the given `io`, the `socket` it creates from it on the client, the
  `room` and the `clients` roster, plus the wire pair `emit(type, data, clients?)` — `clients` is a
  `ClientStatus` or an array of them, omitted means the whole room (server) / the server itself (client)
  — and `on(type, listener)`, which detaches on root destroy;
  it must never import from `xsync.ts`). `xsync`
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
  server-side `xmatter.init()` crashed on room boot, surfacing as the client
  immediately showing "切断". (`matter-js`/`voxelkit` *do* default-export — per-package.)

- **`captureStateTree(clientId)` runs once per connected client (per-client projection, 2026-07).**
  The server no longer broadcasts one `'sync'` tree to the room; it loops `roomio.clients` and emits
  `io.to(client.id).emit('sync', captureStateTree(client.id))`. Consequence for tests: a capture-only
  test that boots the server and reads `hub.lastSync()` must **connect a client first** (`hub.connect()`),
  or nothing is emitted (empty `roomio.clients` → no `'sync'`). `io-mock` records the target of each
  `'sync'` — use `hub.lastSyncFor(clientId)` to read one client's projection. Since 2026-08 the server
  also **skips emitting when a client's projection is unchanged**, so a test that updates twice without
  mutating state records ONE `'sync'` (count with `hub.syncCountFor(clientId)`).
- **`captureStateTree` / `applyStateTree` are boot-internal (not exported).** Capture lives
  in boot's server branch (closes over `root` + a local `nextId`), apply in the client branch
  (closes over `root` + a local `reconcileMap`). The only seams are: server emits `'sync'` on
  `root.on('update')`, client applies on `socket.on('sync')`. To drive them in tests, go through
  boot's wiring — `io-mock` records emitted `'sync'` trees (`hub.lastSync()`) and the mock client
  socket has `fire(event, payload)` to inject a down-event (e.g. a hand-built tree) in client env.
  Never re-add a direct `import { captureStateTree, applyStateTree }`.
- **`new RoomIO(bootOptions, ...args)` creates the root unit in its constructor and hangs itself on
  `inherited.syncRoot`; resolve it from any descendant with `RoomIO.of(unit)` (`RoomIO.of(unit, true)`
  throws when there is no sync root).** boot builds the RoomIO first, then wires its channels around
  `roomio.root` / `roomio.io` — the root's component body runs inside the constructor, so anything the
  body may call must already be reachable through the RoomIO, not through a local set afterwards.
- **Capture runs after children update.** `Unit.update` recurses children *then* runs the unit's
  own update systems, so the `root.on('update')` capture sees this tick's child mutations. A
  single `asServer(() => Unit.update(server))` both advances server logic and broadcasts state.
- **`RoomIO` (client) owns the socket — don't create it in callers or in boot.** Pass
  `{ io, client, room }` (`client` is `{ name }`); the RoomIO constructor does
  `io({ query: { roomId: room.id, clientName: client?.name ?? '' }, forceNew: true })` and disconnects it
  on root destroy
  and the server reads `query.roomId` / `query.clientName`. Keep the query **flat
  strings** (socket.io stringifies query values, so a nested object would arrive as
  `[object Object]`). boot dispatches `sync.connect`/`sync.disconnect`/`sync.notfound` into the
  root (see §11) — there is no boot-parent `-event` forward anymore, so host-side listeners go in
  boot's root component (`xsync.boot(opts, (u) => { xnew.extend(Game); … })`). When you change a
  query key, update every reader in one pass:
  boot's connection handler **and** the examples' Lobby/Room server blocks (`examples/*/server.js`)
  **and** the test mocks (`io-mock.ts` — its server-side socket also implements `to(room)` for the
  connect/disconnect relay).
- **When changing `BootOptions` (the one shared server/client boot options bag, defined in `roomio.ts`
  since `RoomIO`'s constructor takes it), update the test
  `bootClient` adapter in `test/sync/io-mock.ts` too.** It wraps a pre-made mock socket as
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
- **In jsdom tests, advance the fake timers before dispatching a DOM event on a
  unit created after the test started.** `on(...)` attaches through
  `setTimeout(…, 0)` (`attach` in `dom.ts`), so a click dispatched in the same
  tick as the `xnew(...)` that created the button silently does nothing — call
  `jest.advanceTimersByTime(1)` first.
- **`xnew.emit` requires a `+` or `-` prefix — an unprefixed type now throws.**
  Only `'+event'` (broadcast) and `'-event'` (own unit) have a dispatch path, so a
  missing `-` used to fail silently while `on('event', …)` also bound the name as a
  DOM listener. `xsync.emit` is a different channel and still takes unprefixed types.
- **Text content always needs a target; there is no bare-content form.**
  `xnew('hello')` throws `invalid tag string` (a leading string is always parsed
  as a tag) and `xnew(42)` throws `text content needs a target element`. Write
  `xnew('<p>', 'hello')` — without a target the literal would overwrite the
  borrowed parent element and wipe its children.
- **A define overriding another define across `extend` is intentional, not a bug —
  last extended wins.** That is how `extend` implements method overriding
  (`extend.test.ts` → "derived definition overrides a base method" / "the last
  extended base wins on name collision"). Only a collision with a built-in Unit
  member throws. Do not "fix" the guard in `Unit.extend` to throw on define-over-define.
- **Two units may share one handler function on the same target.** Listener entries
  are keyed by the `(listener, owner)` pair, so `target.on('-x', shared)` from two
  components registers twice and each detaches with its own owner. (Registering the
  same pair twice is still deduped.)
- **A listener added during an emit belongs to the next emit, not the current one** —
  `Unit.emit` iterates a copy, as `Unit.update` does.
- **Never let a client-supplied wire `type` reach `dispatch` unchecked.** `bootServer`
  rejects the reserved `sync.*` namespace on `emitToServer` and coerces `syncId` to a
  number-or-null; without that, a client could spoof `sync.disconnect` for another
  member. A relay envelope's `to` is filtered against the room roster for the same
  reason — an unfiltered id would reach a socket in another room. Anything else a server unit listens for is still reachable from any client,
  so **server handlers must validate their own payloads**.
