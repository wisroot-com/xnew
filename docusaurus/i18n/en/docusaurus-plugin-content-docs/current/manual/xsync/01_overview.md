# xsync

`xsync` is xnew's network synchronization layer. **The server is the single source of truth**, and clients hold replicas of it.

The same component function runs on both Node (server) and the browser (client); `xsync.server` / `xsync.client` only decide which environment a block runs in. In practice, game logic goes on the server side and rendering plus input goes on the client side.

```js
import { xnew, xsync } from '@mulsense/xnew';

export function Player(unit) {
  const state = xsync.state({ x: 0, y: 0 });   // shared state

  xsync.server(() => {                          // runs on Node only
    unit.on('update', () => { state.x += 1; });
  });

  xsync.client(() => {                          // runs in the browser only
    const el = xnew.nest('<div class="absolute w-4 h-4 bg-blue-500">');
    unit.on('update', () => { el.style.left = `${state.x}px`; });
  });
}
```

## The big picture

```
        server (Node)                                  client (browser)
  ┌───────────────────────────┐                  ┌───────────────────────────┐
  │ xsync.boot({ io, room })   │                  │ xsync.boot({ io, client,  │
  │   Game                     │                  │              room })       │
  │   └ World                  │ ── 'sync' ────▶  │   Game                     │
  │      ├ Player (state)      │  state channel   │   └ World                  │
  │      └ Player (state)      │  on change only  │      ├ Player (replica)    │
  │                            │                  │      └ Player (replica)    │
  │  unit.on('-move')          │ ◀── 'emitToServer'│  xsync.emit('-move')        │
  └───────────────────────────┘   messages       └───────────────────────────┘
```

- **State is one-way.** It only flows from server to client.
- **Client input** travels as a message (`xsync.emit`); the server is what mutates state.
- **No socket ever talks to another socket.** A client can address other clients with the third argument of `xsync.emit`, but the server always relays it.

### The three channels

These are the socket event names `xsync` reserves — never use them as application event types.

| Channel | Direction | Wire event | Role |
| --- | --- | --- | --- |
| State | server → client | `sync` | Snapshot of the sync tree. Sent **only when it changed** |
| Roster | server → client | `status` | Room membership list |
| Message | client → server | `emitToServer` | Fire an arbitrary event on the server (or, with a target, have the server relay it) |
| Message | server → client | `emitToClients` | Fire an arbitrary event on the clients |
| Lifecycle | both | `connect` / `disconnect` / `notfound` | Delivered to units as `sync.connect` and friends |

### Examples

- `examples/1_xnew/sync/multiplay/` — lobby / rooms, scene sync, chat
- `examples/1_xnew/sync/hidden-info/` — secret information via `xsync.visibility`

---

## Environment split — `xsync.server` / `xsync.client`

The same component function runs on both the server and the client. The environment is detected automatically: Node is `server`, a browser (where `window.document` exists) is `client`.

```js
function Player(unit) {
  xsync.server(() => { /* runs on Node only */ });
  xsync.client(() => { /* runs in the browser only */ });
}
```

- They behave like `xnew.extend`: the object the callback returns becomes defines on the unit.
- They are **init-only** (callable during the synchronous body of the component function).
- On the other side the **callback never runs at all**. Any browser-only API must live inside `xsync.client`.

:::warning Importing browser-only libraries
Never **statically import** an addon (`xpixi`, `xthree`, …) or a browser-only library from a `game.js` shared by server and client. `import` resolves before `xsync.client` ever gets to branch, so Node loads it too and crashes. Hand it over dynamically instead — for example, put it on `window` from the browser entry (`index.js`).
:::

---

## Booting — `xsync.boot`

Creates the root of a sync tree. The arguments differ slightly between the two sides.

```js
// server
xsync.boot({ io, room }, Game);

// client
xsync.boot({ io, client, room }, Game);
```

| Property | Type | Description |
| --- | --- | --- |
| `io` | `any` | On the server, the socket.io `Server` instance. On the client, the factory that creates a socket (`window.io`) |
| `room` | `{ id, name, count }` | The room to join. `id` separates socket.io rooms |
| `client` | `{ name }` | Client side only. Display name; travels in the handshake query |

On the client, `boot` **creates and owns the socket itself**. Callers must not create one (that would open a second connection). When the unit `boot` created is destroyed, the socket is disconnected automatically.

```js
// what boot does internally (client)
io({ query: { roomId: room.id, clientName: client?.name ?? '' }, forceNew: true });
```

`boot` takes **one** root component (plus optional props). Lifecycle listeners must live **inside the root**, so the usual shape is a root component that mixes the game in with `xnew.extend`.

```js
xsync.boot({ io, client, room }, (u) => {
  xnew.extend(Game);
  u.on('sync.connect', ({ id }) => { /* ... */ });
  u.on('sync.notfound', () => unit.change(Lobby));
});
```

:::info The root is a protect boundary
A booted root is `xnew.protect()`ed. One Node process usually holds several rooms, and a keyless `xnew.find` or a `'+event'` must not reach into the units of another one (event delivery has always been per-room). Units inside a room are likewise not findable from outside it.
:::

:::info Lobbies and rooms are not part of xsync
`xsync` provides only the sync facade — boot, state, emit and so on. "Gathering place" wiring (room listings, room creation) is assembled in your application with socket.io directly; `examples/1_xnew/sync/multiplay/server.js` is a worked example.
:::

### `xsync.session`

Returns session information for the current sync root. Available under that root only.

```js
xsync.session.room       // { id, name, count } the room you are in
xsync.session.clients    // [{ id, name }, ...] room members
xsync.session.myself     // { id, name } yourself (client only)
```

- `clients` is readable on both sides. The server updates it as connections are accepted; the client receives it over the `status` channel.
- `myself` is **client-only** — reading it on the server throws, since the server has no "self".
- When the roster changes, `sync.status` fires on both sides.
- A member with no socket behind it (`xsync.cpu.join`, below) appears in this list too, as `{ id, name, cpu: true }`.

### CPU members — `xsync.cpu.join` / `xsync.cpu.leave` / `xsync.cpu.dispatch`

On the server only, you can put a member with **no socket behind it** on the roster (a seat the server itself plays, for instance).

```js
xsync.cpu.join({ id: 'cpu:1', name: 'CPU 1' });     // join the roster (fires 'sync.connect')
xsync.cpu.dispatch('play', 'cpu:1', { card: 7 });   // act as that member: one message, as if it had sent it
xsync.cpu.leave('cpu:1');                           // leave the roster (fires 'sync.disconnect')
```

- To the tree it is indistinguishable from a member who arrived over the wire: it lands in `session.clients`, `sync.connect` / `sync.disconnect` fire on both sides, and the `status` channel puts it in every client's roster. Existing games seat it, name it and log it with the code they already have.
- The wire skips it. **No projection (`sync`) is sent to it**, and no message can arrive from it. State made private to its id with `xsync.visibility` therefore never reaches anyone's wire (the server reads it straight from the sync tree).
- `xsync.cpu.dispatch` delivers one message to this room as if that member had sent it, so it enters through the same handler — and the same validation — as a human's move. The reserved namespace (`sync.`) and any id that is not a CPU member are refused.
- All three are server-side only (calling them on a client throws). A real client cannot be removed with `xsync.cpu.leave`; it leaves by disconnecting.

---

## Shared state

### The sync tree

Below the server's `boot` root sits an ordinary unit tree. Only units created from a component **registered in their parent with `xsync.register`** count as sync nodes and get replicated to clients.

```
server                                 client
  Game        ← boot root                Game        ← boot root
   ├ (div)    ← not a sync node           (not replicated)
   └ World    ← registered  ─────────▶    World      ← replica
      └ Player ← registered ─────────▶      └ Player  ← replica
```

- Unregistered units are **passed through**: if their children are sync nodes, those children attach to the nearest sync node above. Wrapping DOM does not disturb the tree shape.
- Each sync node gets an id starting at 1, and keeps it for the life of the unit.

### `xsync.register`

Declares which components may be synced as children of this unit. **The client uses this table to look up a component by the name that arrives and build the replica.** A name that is not registered is ignored.

```js
export function World(unit) {
  xsync.register({ Player });   // Player may be synced as a child of World

  xsync.server(() => {
    xnew(Player, { clientId, slot });   // created on the server → replicated to every client
  });
}
```

- Init-only (calling it outside the `invoked` phase throws).
- The keys are the names that travel on the wire. Register the same key on both sides — sharing one file usually makes this automatic.

### `xsync.state`

Returns the state this sync node shares. It is meant to be **written on the server and read on the client**.

```js
export function Player(unit, { slot = '' } = {}) {
  const state = xsync.state({ x: 0, y: 0, slot });

  xsync.server(() => {
    unit.on('update', () => { state.x += 1; });   // the server writes
  });

  xsync.client(() => {
    unit.on('update', () => { el.style.left = `${state.x}px`; });   // the client reads
  });
}
```

- It returns **the same object** for the unit every time — repeat calls hand back the same reference.
- The initial values are applied **only to keys that don't exist yet**. A client replica is constructed already holding the server's values, so writing `xsync.state({ x: 0 })` never clobbers the server value with 0.
- Values travel as JSON. Functions, DOM elements and class instances cannot be stored (numbers, strings, booleans, arrays and plain objects only).
- Writing state on the client is overwritten as soon as the next server value arrives. Send change requests as events instead.

### Replica creation and disposal

The client **reconciles** each arriving tree.

| On the server | On the client |
| --- | --- |
| A sync node is created | Look the component up in the `register` table and create a replica unit |
| State changed | Update the existing replica's state **in place** (the unit is not rebuilt) |
| A sync node was destroyed | Destroy the matching replica |
| A node became invisible (see visibility below) | Treated as a deletion (the replica is destroyed) |

State updates rewrite keys rather than swapping the object, so it is safe to capture the reference from `xsync.state` in a closure.

:::info props are a server-side thing
The props in `xnew(Player, { clientId, slot })` reach only the unit created on the server. Replicas are constructed without props. Anything the client also needs must be **carried in state** — that is why the example above puts `slot` there.
:::

---

## Events

State (`xsync.state`) flows only from server to client. Anything going the other way, and any transient notification you don't want to keep in state (chat, a sound trigger), travels as an event.

### Sending

Sending is one method: `xsync.emit(type, props, clients?)`. The third argument names the destination; omit it for a single hop — from a client to the server, from the server to the whole room.

| Called from | `clients` | Fires on |
| --- | --- | --- |
| a client | omitted | the server (with the sender in `id`) |
| the server | omitted | every client in the room (the sender included) |
| both | `ClientStatus` | that one client, via the server |
| both | `ClientStatus[]` | only the listed clients, via the server (an empty array reaches nobody) |

```js
// client → server
xsync.emit('-move', { vector: { x: 1, y: 0 } });

// server → every client (including the sender)
xsync.emit('chat', { id, text });

// client / server → specific clients only (a client's send is relayed by the server)
xsync.emit('deal', { card }, target);                                  // one ClientStatus
xsync.emit('deal', { card }, xsync.session.clients.filter(isPlayer));   // a ClientStatus[]
```

- Targets are `ClientStatus` values from `xsync.session.clients`. Given an `id` (from `sync.connect`, say),
  look it up with `xsync.session.clients.find((c) => c.id === id)`.
- When it relays, the server checks each target against its own room roster — a socket id from another room is dropped.
- To fire something locally on the server without touching the wire, use `xnew.emit`, not `xsync.emit`.

```js
// the standard shape: the server receives a client's message and hands it to everyone
xsync.server(() => {
  unit.on('chat', ({ id, text }) => xsync.emit('chat', { id, text }));
});
xsync.client(() => {
  sendButton.on('click', () => xsync.emit('chat', { text: input.value }));
  unit.on('chat', ({ id, text }) => appendLine(id, text));
});
```

### Receiving

Everything is received with an ordinary `unit.on`.

```js
unit.on('chat', ({ id, text }) => { /* ... */ });
```

The first argument carries sender information alongside your payload.

| Field | Contents |
| --- | --- |
| `id` | The sender client's socket id. **`undefined` when the server originated it (`xsync.emit` called on the server)**; on a relayed client message the server stamps the original sender |
| others | The contents of `props`, spread in |

When the server relays a message and you want the original sender preserved, put it in `props` explicitly — that is what `{ id, text }` above is doing.

### Scoping with the `-` prefix

When a component exists many times in a room (one `Player` per participant), you need to narrow the destination.

| Type name | Reaches |
| --- | --- |
| `'-move'` | Listeners on **the same sync node** only (the one replica ↔ server pair) |
| `'chat'` (no prefix) | Every unit under that root listening for the type |

```js
// Player: deliver this client's input only to "its own" Player on the server
xsync.client(() => {
  unit.on('window.keydown.wasd', ({ vector }) => xsync.emit('-move', { vector }));
});
xsync.server(() => {
  unit.on('-move', ({ vector }) => { vel.x = Math.sign(vector.x); });   // other players' moves never arrive
});
```

`-` works when sender and receiver belong to the same sync node (the same id). A replica carries the id of its server-side node, so the pairing is automatic.

:::warning Reserved names
`sync`, `status`, `emitToServer` and `emitToClients` are reserved wire event names. Do not use them as application `type`s.
:::

### Lifecycle events

These fire automatically under the boot root. **Listeners must live inside the boot root.**

| Event | Side | Meaning |
| --- | --- | --- |
| `sync.connect` | both | The participant `{ id }` connected |
| `sync.disconnect` | both | The participant `{ id }` disconnected |
| `sync.notfound` | client | The room being joined did not exist (own connection failure only) |
| `sync.status` | both | The roster (`xsync.session.clients`) changed |
| `sync.update` | **client only** | An incoming state update has been applied |

Tell yourself from others by comparing ids.

```js
unit.on('sync.connect', ({ id }) => {
  if (id === xsync.session.myself.id) { /* I joined */ }
  else { /* somebody else joined */ }
});
```

Your own events come from your own socket; other members' events are relayed by the server (the sender is excluded, so nothing fires twice).

`sync.update` fires **exactly once** at the moment the server's state actually changed and has been applied. Use it for rebuild-style UI.

```js
let dirty = true;
unit.on('sync.update', () => { dirty = true; });
unit.on('update', () => {
  if (dirty) { rebuild(); dirty = false; }   // rebuild inside the tick
});
```

Per-frame following (physics objects and the like) should read state in `on('update')` without waiting for `sync.update`.

### Where `xnew.scope` is required

Socket callbacks run outside xnew's tick. Every event `xsync` delivers is already handled internally, but if **your application attaches its own socket handlers**, or you call `xsync.emit` from an addon event (a pixi `pointerdown`, a three raycast hit), wrap it in `xnew.scope`. Without it `Unit.current` is wrong and you get `no socket bound to this root`.

```js
socket.on('roomcreated', xnew.scope((payload) => xnew.emit('-roomcreated', payload)));
```

---

## Visibility — `xsync.visibility`

Some state is meant for one client only — a hand of cards, a secret role. `xsync.visibility` declares **which clients a sync node is sent to**.

```js
export function PlayerView(unit, { ownerId = '' } = {}) {
  const state = xsync.state({ ownerId, secret: 0, revealed: false });

  xsync.server(() => {
    state.secret = 1 + Math.floor(Math.random() * 100);
    xsync.visibility((clientId) => state.revealed || clientId === state.ownerId);
  });

  xsync.client(() => {
    xnew('<p>', `your number: ${state.secret}`);
  });
}
```

```js
xsync.visibility(predicate);   // (clientId: string) => boolean
xsync.visibility(null);        // back to public
```

- Sync nodes are **public** by default. A node that never declares visibility reaches everyone.
- A client the predicate rejects sees the node **as if it did not exist**: nothing arrives, so no replica is created (an existing one is destroyed).
- **The whole subtree is excluded with it.** Sending a child whose parent is hidden would leave the parent id dangling.
- The predicate is **re-evaluated on every capture**, so closing over a flag and flipping it is all a dynamic reveal takes (`revealed` above).

### Why it must be declared on the server

`visibility` decides what goes on the wire. **An excluded client is never sent that state at all.**

```
server ── captureStateTree('clientA') ──▶ clientA  … only A's PlayerView
       ── captureStateTree('clientB') ──▶ clientB  … only B's PlayerView
```

Hiding on the client — simply not drawing it — protects nothing, because DevTools shows the payload. Always declare visibility inside the `xsync.server` block.

The typical shape is one node per client, declared visible only to its owner (a working example lives in `examples/1_xnew/sync/hidden-info/`).

```js
xsync.server(() => {
  unit.on('sync.connect', ({ id }) => xnew(PlayerView, { key: id, ownerId: id }));
  unit.on('sync.disconnect', ({ id }) => xnew.find(PlayerView, { key: id })[0]?.destroy());
});
```

---

## Update timing and bandwidth

This section answers the obvious question: "it runs at 60Hz — does the server push state every frame?"

**Short answer: the tick is 60Hz, but state is only sent when it changed.**

### The tick is 60Hz

The xnew engine holds a single 60fps ticker, and every unit's `update` event fires from it.

- Browser: `requestAnimationFrame`
- Node: `setTimeout`

Both use an absolute schedule (the target time advances by `+= 1000/60`), so the fractional remainder carries over and the average rate holds at 60Hz. The server (Node) and the client (browser) run on this same mechanism.

### The state channel sends on change only

Every tick, the server's boot root does this:

```
each tick, for every connected client:
  1. walk the sync tree and build that client's projection (applying visibility)
  2. serialize it to JSON
  3. compare it with the string last sent to that client
  4. emit 'sync' only if they differ
```

Which means:

- **If nothing is moving, nothing goes on the wire.** During a title screen or while waiting for a turn, bandwidth is zero.
- **If one value changes, the whole projection for that client is sent.** There are no field-level deltas; the diffing happens on the client.
- Put the other way round: **a `sync` arriving means something changed.** The client fires `sync.update` off the back of it.

The client keeps the same comparison (against the last tree it applied), so a server that re-sends identical content will not fire `sync.update` twice.

### What counts as a change

The test is **exact string equality of the whole serialized projection**. Adding or removing a node, reordering, or a single field of one node's state changing — all of them count.

Two practical consequences follow.

**1. Tiny changes still mean a send every frame**

If a physics simulation keeps nudging a coordinate, the object looks stationary but the JSON differs every frame, so it keeps sending at 60Hz. To make the wire go quiet at rest, round before storing.

```js
unit.on('update', () => {
  state.x = Math.round(body.position.x * 10) / 10;   // snap to 0.1 → sending stops when it settles
});
```

**2. Don't put values in state that don't need to travel**

The comparison and the send are per tree, not per node. A frequently-changing internal value in state raises the send rate for the whole room. Keep server-only values in ordinary local variables.

### Messages and lifecycle events ignore the tick

`xsync.emit` is sent **the moment you call it**; nothing batches them onto a tick. Input latency is therefore unaffected by the tick — a keypress goes to the server immediately.

`sync.connect`, `sync.disconnect` and `status` (the roster) are likewise handled as socket events, immediately.

### Bandwidth estimate

One node serializes to roughly this:

```json
{"id":3,"name":"Player","parent":2,"state":{"x":112,"y":64,"clientId":"aBc123","slot":"p1"}}
```

About 90 bytes. For a two-player game with four sync nodes (World + Player×2 + Board), one `sync` is roughly 350–400 bytes. In the worst case, with both players moving so every tick differs:

```
400 bytes × 60Hz ≈ 24 KB/s per client
```

and it drops to zero once movement stops. This is an estimate — measure the real numbers in the DevTools Network panel (WS frames).

### CPU cost is linear in client count

Sending happens only on change, but **building the projection and serializing it happens every tick, once per client** (because `visibility` may return a different result per client).

```
server load per tick ≈ O(connected clients × sync nodes)
```

For rooms of a handful to a dozen participants this is a non-issue; if you design for large rooms, keeping the node count and state size small is what pays off.

### Client-side render timing

The client's `update` is driven by rAF, so it is **independent of when state arrives**.

- Arrivals are applied to state as socket events, whenever they land.
- Rendering happens on the 60Hz `update`, reading whatever state is current at that moment.

There is no interpolation or prediction (no client-side prediction, no lag compensation) built in. The client **draws the last state it received**. With a server ticking at 60Hz that is usually smooth enough, but poor connections will show stutter. Interpolate the state values yourself in the render path if you need it.

:::info While a tab is hidden
The browser suspends `requestAnimationFrame` in a hidden tab, so the client's `update` stops. Reception continues and state stays current, so returning to the tab resumes from the latest state. The server's tick (Node) is unaffected.
:::
