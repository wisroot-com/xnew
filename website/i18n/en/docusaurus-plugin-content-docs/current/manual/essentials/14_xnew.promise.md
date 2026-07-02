# xnew.promise

`xnew.promise` ties a Promise to the current component so its `.then()` / `.catch()` / `.finally()` handlers run in the component's scope. If the component is destroyed before the Promise resolves, the pending handlers are dropped — no stale DOM writes, no crashes.

## Usage

```js
xnew.promise(source);        // register / aggregate a Promise, function, or unit
xnew.promise(key, source);   // register under a key
xnew.promise();              // deferred (returns { resolve, reject })
```

**Parameters:**
- `key` (optional): the property name this promise's value lands under in the aggregate result
- `source`: a standard Promise, a `(resolve, reject) => { ... }` function, or a unit (aggregates the promises registered on that unit)

**Returns:**
- A wrapped Promise that runs its handlers within the current `xnew` scope (chain `.then` / `.catch` / `.finally`)
- Called with no argument (or only a key), a deferred `{ resolve, reject }`

## Examples

### Wrapping a Promise

```js
xnew((unit) => {
  xnew.promise(fetch('/api/data'))
    .then((res) => unit.element.textContent = 'loaded')
    .catch((err) => unit.element.textContent = 'error');
});
```

### Deferred (resolve manually)

Called with no argument, it returns `{ resolve, reject }` so you can settle it whenever you like.

```js
function Loader(unit) {
  const deferred = xnew.promise();

  unit.on('click', () => deferred.resolve('done'));
}
```

### Aggregating on a unit

Pass a unit to await all the promises registered on it together.

```js
function Assets(unit) {
  xnew.promise('image', loadImage());
  xnew.promise('sound', loadSound());
}

const assets = xnew(Assets);
xnew.promise(assets).then((results) => {
  // results === { image: <image>, sound: <sound> }
  console.log('all assets ready', results);
});
```

The aggregate is **always an object**.

- Promises registered **with a key** become that key's property.
- Promises registered **without a key** are awaited, but their values are not included in the result.
- Appending `[]` (e.g. `xnew.promise('name[]', ...)`) collects same-named keys into an array in registration order.

Aggregating does not consume the target unit's pool, so the same unit can be aggregated repeatedly and always yields the same result.
