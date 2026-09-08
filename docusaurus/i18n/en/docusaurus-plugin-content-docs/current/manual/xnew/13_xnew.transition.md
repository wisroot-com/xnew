# xnew.transition

`xnew.transition` drives a value from `0` to `1` over a set duration, calling your callback every frame. Feed that value into any property — opacity, position, scale, color — and you get smooth animation with one function call.

It's also chainable: you can sequence timeouts and transitions without nesting callbacks.

## Usage

```js
const timer = xnew.transition(callback, duration, easing);
```

**Parameters:**
- `callback({ value })`: Function called on each frame with progress value (0.0 to 1.0)
- `duration`: Animation duration in milliseconds (default: 0)
- `easing`: Easing function name (default: 'linear')

**Returns:**
- A timer object with:
  - `clear()`: Cancel it
  - `timeout(...)` / `interval(...)` / `transition(...)`: Chain another step

## Available Easing Functions

- `'linear'` - Constant speed
- `'ease'` - Slow start and end, fast middle
- `'ease-in'` - Slow start
- `'ease-out'` - Slow end
- `'ease-in-out'` - Slow start and end

## Example

### Fade In Animation

```js
xnew('<div>', (unit) => {
  unit.current.textContent = 'Fading in...';
  unit.current.style.opacity = '0';

  xnew.transition(({ value }) => {
    unit.current.style.opacity = value;
  }, 2000, 'ease-in');
});
```
### Canceling Transitions

```js
xnew('<div>', (unit) => {
  unit.current.textContent = 'Click to stop animation';

  const transition = xnew.transition(({ value }) => {
    unit.current.style.opacity = 1 - value;
  }, 5000, 'linear');

  unit.on('click', () => {
    transition.clear();
    unit.current.textContent = 'Animation stopped';
  });
});
```

## Automatic Cleanup

When a unit is destroyed, all its transitions are automatically cleared:

```js
const unit = xnew((unit) => {
  xnew.transition(({ value }) => {
    console.log('Progress:', value);
  }, 5000, 'linear');
});

// Destroy after 2 seconds - transition automatically stops
xnew.timeout(() => {
  unit.destroy();
}, 2000);
```
