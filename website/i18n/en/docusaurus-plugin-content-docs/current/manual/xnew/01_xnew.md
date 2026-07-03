# xnew

`xnew` is the core function of the library. It creates a **unit** — the component instance. When a unit is destroyed, everything inside it (timers, listeners, child elements) is cleaned up automatically, so you never have to write teardown code by hand.

## Usage

```js
const unit = xnew(target, Component, props); // target is optional
```

- `target` *(optional)* — where to attach. A DOM element, or an HTML string like `'<div class="box">'`. If omitted, the parent's element is inherited.
- `Component` *(optional)* — a function that defines this unit's behavior.
- `props` *(optional)* — data passed as the second argument of the component function.

## Components

A component is a function. It receives its unit and the props passed at creation. There is no special syntax for inheritance or extension.

```js
function MyComponent(unit, { message }) {
  unit.element.textContent = message; // unit.element is the attached DOM element
}

const unit = xnew(MyComponent, { message: 'Hello World' });
```

Arrow functions work the same way.

```js
xnew((unit) => {
  unit.element.style.color = 'blue';
});
```

## Targets

`target` decides where the component attaches. You can always reach it through `unit.element`.

```js
// 1. Attach to an existing DOM element
xnew(document.querySelector('#app'), (unit) => { /* unit.element === #app */ });

// 2. Create a new element from an HTML string
xnew('<div class="box">', (unit) => { /* unit.element === the new div */ });

// 3. Omit target to inherit the parent's element
xnew((unit) => { /* unit.element === parent's element */ });
```

Passing a string or number in place of `Component` creates an element whose `textContent` is that value.

```js
xnew('<p>', 'This is a paragraph'); // <p>This is a paragraph</p>
```

## Events

DOM events, lifecycle events, and custom events are all handled through `unit.on` / `unit.off`. The callback receives an object with the event details as its first argument.

```js
const unit = xnew(MyComponent);

unit.on('click', ({ event }) => console.log('clicked'));

unit.off('click'); // remove all 'click' listeners
unit.off();        // remove all listeners
```

## Lifecycle events

The whole lifecycle is covered by two events. Subscribe only to the ones you need.

| Event       | When it fires                |
| ----------- | ---------------------------- |
| `update`    | every frame (roughly 60fps)  |
| `finalize`  | when the unit is destroyed   |

```js
function AnimatedBox(unit) {
  let angle = 0;
  unit.on('update', () => {
    angle++;
    unit.element.style.transform = `rotate(${angle}deg)`;
  });
  unit.on('finalize', () => console.log('cleaned up'));
}
```

### Lifecycle control methods

A unit starts automatically when it is created, and its `update` loop begins running. Use `finalize` to destroy it.

- `unit.finalize()` — destroy the unit and remove the elements it created from the DOM.

```js
const unit = xnew('<div>', 'Click to destroy');
unit.on('click', () => unit.finalize());
```

### Execution order

Events such as `update` fire on children **before** their parent (teardown via `finalize` is the reverse — children first).

```js
function Parent(unit) {
  xnew(Child);
  unit.on('update', () => console.log('Parent update'));
}
function Child(unit) {
  unit.on('update', () => console.log('Child update'));
}
xnew(Parent);

// Output (each frame):
// Child update
// Parent update
```

## DOM event payloads

Standard DOM event names can be passed straight to `unit.on`. Some events provide convenient values alongside `event`.

| Event                                 | Payload                              |
| ------------------------------------- | ------------------------------------ |
| `click` / `pointerdown`, etc.         | `{ event, position }` — element coords |
| `change` / `input`                    | `{ event, value }` — the input value  |
| `wheel`                               | `{ event, delta }`                   |
| `dragstart` / `dragmove` / `dragend`  | `{ event, position, delta }`         |
| `window.keydown.arrow` / `.wasd`      | `{ event, vector }` — direction vector |

```js
unit.on('pointerdown', ({ position }) => console.log(position.x, position.y));
unit.on('input', ({ value }) => console.log(value));
```

- Prefix with `window.` / `document.` to bind the listener to `window` / `document` (e.g. `'window.keydown'`).
- Suffix with `.outside` to fire when the event happens outside the element (e.g. `'pointerdown.outside'`).

## Custom events

A prefix on the event name selects its communication scope, keeping components loosely coupled. Send with `xnew.emit`, receive with `unit.on`.

- `+` prefix — **global**. Every active unit can receive it (score updates, game-over notifications, etc.).
- `-` prefix — **internal**. Only the sending unit's own listeners receive it (a child notifying its parent, etc.).

```js
function Sender(unit) {
  unit.on('click', () => xnew.emit('+message', { text: 'Hello!' }));
}
function Receiver(unit) {
  unit.on('+message', ({ text }) => console.log(text));
}

xnew(Sender);
xnew(Receiver); // receives even without a parent-child relationship
```

## Custom methods

When a component function returns an object, its **function properties** (methods, getters, setters) are added to the unit. This lets you encapsulate internal state while exposing only the operations you want.

```js
function Counter(unit) {
  let count = 0;
  return {
    increment() { count++; },
    get value() { return count; },
  };
}

const counter = xnew(Counter);
counter.increment();
console.log(counter.value); // 1
```

### Reserved property names

These names are already used by the unit, so they cannot be used for custom properties.

- `finalize`
- `element`, `parent`, `promise`, `on`, `off`
- `_` (internal)

Next, see [`xnew.nest`](./xnew.nest) for building nested structures concisely.
