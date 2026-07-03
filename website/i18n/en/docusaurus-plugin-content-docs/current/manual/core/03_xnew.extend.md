# xnew.extend

`xnew.extend` mixes another component's behavior into the current unit. No new element is created. Write reusable behavior — dragging, logging, keyboard handling — once as a component, and drop it into any other component with one line.

## Usage

```js
xnew.extend(Component, props);
```

**Parameters:**
- `Component`: A component function to extend with
- `props`: Optional properties passed to the component function

**Behavior:**
- Executes the component function immediately in the current unit's context.
- Merges returned properties/methods onto the current unit.
- Event handlers accumulate — they are never overridden by later extensions.
- If two extensions return the same property name, the later one wins.

## Example

### Mixing in a Logger

```js
function Logger(unit) {
  return {
    log(message) {
      console.log(`[${new Date().toISOString()}]`, message);
    }
  };
}

const unit = xnew((unit) => {
  xnew.extend(Logger);

  unit.log('Application started'); // immediately available
});

// Output: [2025-01-15T10:30:00.000Z] Application started
```

### Mixing in Behavior (Draggable)

A more practical example — pull drag logic into its own component and reuse it anywhere:

```js
function Draggable(unit) {
  let dragging = false;
  let startX, startY, originX, originY;

  unit.on('mousedown', ({ event }) => {
    dragging = true;
    startX = event.clientX;
    startY = event.clientY;
    originX = parseInt(unit.element.style.left) || 0;
    originY = parseInt(unit.element.style.top)  || 0;
  });

  unit.on('window.mousemove', ({ event }) => {
    if (!dragging) return;
    unit.element.style.left = originX + (event.clientX - startX) + 'px';
    unit.element.style.top  = originY + (event.clientY - startY) + 'px';
  });

  unit.on('window.mouseup', () => { dragging = false; });

  return { get isDragging() { return dragging; } };
}

// Any component can become draggable with one line:
function Card(unit) {
  xnew.extend(Draggable);
  xnew.nest('<div class="card" style="position:absolute;">');
  xnew('<p>', 'Drag me!');
}

xnew(Card);
```

:::note
`xnew.extend` can only be called during component initialization (inside the component function). You cannot call it after the unit is created.
:::

