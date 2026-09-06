# xnew.scope

`xnew.scope` captures the current component context and returns a wrapper that restores it when called. The xnew scope is normally lost inside a raw `setTimeout` or a native `addEventListener`, so this is the escape hatch for calling xnew APIs from those callbacks.

You usually won't need it: `xnew.timeout`, `xnew.interval`, and `unit.on` all preserve scope automatically.

## Usage

```js
xnew.scope(callback);
```

**Parameters:**
- `callback` - Function to execute with preserved scope

**Returns:**
- Wrapped function with preserved scope

## Examples

### Preserving Scope in setTimeout

```js
function Timer(unit) {
  xnew.nest('<div>');

  setTimeout(xnew.scope(() => {
    // The Timer component scope is preserved in this callback
    console.log('Timeout executed');
  }), 1000);
}
```

### Using with Event Listeners

```js
function Button(unit) {
  const el = xnew.nest('<button>');
  el.textContent = 'Click me';

  el.addEventListener('click', xnew.scope(() => {
    // The Button component scope is preserved on click
    console.log('Button clicked');
  }));
}
```

