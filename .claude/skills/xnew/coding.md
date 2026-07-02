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

## 3. Creating units — `xnew(...)`

- `xnew(Component, props)` — create a child of the **current** unit.
- `xnew(parentUnit, Component, props)` — create under an explicit parent unit
  (runs in that parent's scope). Used to mount siblings/children outside the body.
- `xnew('<div class="…">', …)` / `xnew(domElement, …)` — the unit's element is
  that DOM target. A tag string creates and nests the element.
- `xnew(target, 'text')` / `xnew('text')` — sets `textContent` (safe for user input).
- `xnew(target, (unit) => { … })` — an inline component function.
- **Init-only helpers** (throw if called after `invoked`, i.e. outside the
  synchronous body or in a later callback): `xnew.nest`, `xnew.extend`,
  `sync.server`, `sync.client`, `sync.register`, `sync.state`.

## 4. DOM: element, nest, events

- `unit.element` is the unit's current DOM element.
- `xnew.nest('<div …>')` nests a child element under the current element and makes
  it current (init-only). `xnew.extend(Base)` mixes another component into this unit.
- DOM events are listened with `unit.on('click', ({ event }) => …)`. The payload is
  always `{ type, … }` plus event-specific fields:
  - default: `{ event }`
  - `click` / `pointer*`: `{ event, position }`
  - `change` / `input`: `{ event, value }`
  - `wheel`: `{ event, delta }`, `drag*`: `{ event, position, delta }`
  - `window.`/`document.` prefix attaches to window/document; `.arrow`/`.wasd` give `{ event, vector }`.
- `unit.on('a b c', fn)` registers one listener for several space-separated types.

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
- Callback gets `{ timer }` (transition also `{ value }`, 0→1). Cancel with
  `timer.clear()`. Prefer these over `setTimeout`/`setInterval` for anything tied
  to a unit's lifetime.

## 9. Context & find

- `xnew.context(Component)` → the nearest ancestor unit created/extended with that
  component (its exposed defines are accessible). **Returns `any`** — no type
  checking, so a typo or wrong shape will not be caught at compile time.
- `xnew.find(Component, { key })` → array of matching units (respects `protect`).
- `key` is a **reserved prop** used by `find(..., { key })`; assume it is globally
  unique.

## 10. Scene navigation (`xnew.basics.Scene`)

- `unit.change(Component, props)` mounts the next component as a **sibling** (under
  `unit.parent`) and then finalizes the current scene. Therefore swappable scenes
  must share a common parent container — do not mount a scene directly on a raw
  element, or its replacement lands under `engineRoot`.
- `unit.add(Component, props)` mounts a child under the current scene.

## 11. sync — multiplayer (server ↔ client)

- `sync.server(cb)` / `sync.client(cb)` run `cb` **only** in that runtime
  (Node = server, browser = client; auto-detected). They behave like `extend`: the
  object `cb` returns becomes defines on the unit. They are init-only.
- A component mounted on both sides reads a **different prop shape** per side.
  Split the props into explicit types and cast inside each block, e.g.
  `LobbyServerProps` / `LobbyClientProps`, then
  `const { io } = props as LobbyServerProps;`.
- `sync.boot({ io, room }, Component)` (server) / `sync.boot({ io, client, room }, Component)`
  (client) creates a synced root. On the **client** side boot calls `io(...)` to
  create **and own** the socket, with a **flat string** handshake query
  (`io({ query: { roomId: room.id, clientName: client?.name ?? '' }, forceNew: true })`),
  forwards the socket's `connect`/`disconnect`/`notfound` to the boot **parent** (host)
  unit as `-connect`/`-disconnect`/`-notfound`, and disconnects it on finalize. Callers
  (e.g. `basics.Room`) just boot — they no longer touch the socket. `sync.state`,
  `sync.register`, `sync.toServer`, `sync.toClient` operate on the current sync root.
- Socket handlers run outside the tick → wrap them in `xnew.scope` (§7).
- **Wire event names vs host event names are independent.** A socket/wire event
  (`'roomcreated'`) and the host-facing unit event it is forwarded to
  (`'-roomcreated'`) are separate strings; keep their mapping deliberate.
- **Send events with `sync.toServer` / `sync.toClient` — they name the side the
  event fires on, not the direction you happen to call from.** Receive both with
  `unit.on(type, ({ id, ...props }) => …)` (`id` = sender socket id).
  - `sync.toServer(type, props)` → fires `type` on the **server**. From a client it
    travels over the socket (a `'-type'` is scoped to the server unit sharing the
    sender's `syncId`); on the server it is a local emit (identical to `xnew.emit`,
    so `'+'`/`'-'` only).
  - `sync.toClient(type, props, ids?)` → fires `type` on the **clients** via the
    server. From a client it round-trips through the server to every client incl. the
    sender (`id` = sender); from the server it broadcasts (`id` = `undefined`). `ids`
    limits delivery to those client ids (default: the whole room). This is the
    built-in room broadcast — don't hand-roll a relay component.
  - There is **no** `sync.emit`/`sync.message` anymore. The wire events
    `sync:toServer` / `sync:toClient` / `sync:deliver` are reserved — don't use them
    as app `type`s.

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
- Every file under `src/` starts with the `//----` header comment (Role / Why /
  public API). See `.claude/CLAUDE.md` for the exact convention and keep it current
  when behavior changes.

---

## Pitfalls / lessons learned

Append here when a mistake is found. Newest at the top. Keep each terse:
the rule, then one line of why.

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
  core boot's connection handler **and** `basics` Lobby/Room server blocks **and** the
  test mocks (`io-mock.ts`, `test/basics/sync.test.ts`).
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
