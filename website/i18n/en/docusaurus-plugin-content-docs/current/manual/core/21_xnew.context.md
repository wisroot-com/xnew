# xnew.context

`xnew.context` lets descendant components read shared data from an ancestor. Create a state-holding component once near the root, and any descendant — no matter how deep — can retrieve it without prop-drilling through every intermediate layer.

## Usage

```js
const value = xnew.context(component);
```

**Parameters:**
- `component`: Component function for the context property

**Returns:**
- The context value, or `undefined` if not found

## How It Works

The lookup walks up the unit hierarchy until it finds a match. A child can create the same provider again to shadow the value within that branch — the parent and sibling branches are unaffected.

## Example

### Data Share

```js
xnew((unit) => {
  xnew(Data, { value: 1 });
  xnew(Child);
});

function Data(unit, { value }) {
  return {
    get value() { return value; }
  }
}

function Child(unit) {
  const data = xnew.context(Data);
  
  // data.value
}

```

### Nested Context Override

```js
xnew((unit) => {
  xnew(Data, { value: 1 });
  xnew(Child1);
});

function Data(unit, { value }) {
  return {
    get value() { return value; }
  }
}

function Child1(unit) {
  const data = xnew.context(Data);
  // data.value == 1
  
  xnew(Data, { value: 2 });
  xnew(Child2);
}

function Child2(unit) {
  const data = xnew.context(Data);
  
  // data.value == 2
}
```

## Use Cases

- **Theme / config** — a single `Theme` component at the root, consumed anywhere below
- **Game state** — score, level, or player data shared across the scene tree
- **Scene management** — passing a `Flow` controller down to child scenes without explicit props
- **Dependency injection** — services like audio or input that many components need