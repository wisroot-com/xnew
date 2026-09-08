# xnew.timeout

`xnew.timeout` is `setTimeout` extended for xnew. The timeout is automatically cancelled when the owning unit is destroyed, so you don't need to stash the ID and call `clearTimeout`.

## Usage

```js
const timer = xnew.timeout(callback, duration);
```

**Parameters:**
- `callback`: Function to execute after the delay
- `duration`: Time in milliseconds before execution

**Returns:**
- A timer object with:
  - `clear()`: Cancel it
  - `timeout(...)` / `interval(...)` / `transition(...)`: Chain another step

## Example

### Basic Delayed Execution

```js
xnew('<div>', (unit) => {
  unit.current.textContent = 'Click me!';

  unit.on('click', () => {
    unit.current.textContent = 'Clicked! Resetting in 2 seconds...';

    xnew.timeout(() => {
      unit.current.textContent = 'Click me!';
    }, 2000);
  });
});
```

### Canceling a Timeout

```js
xnew('<button>', (unit) => {
  unit.current.textContent = 'Start countdown';

  let timeout;

  unit.on('click', () => {
    // Cancel previous timeout if exists
    if (timeout) {
      timeout.clear();
    }

    unit.current.textContent = 'Countdown started...';

    timeout = xnew.timeout(() => {
      unit.current.textContent = 'Done!';
    }, 3000);
  });
});
```

## Automatic Cleanup

When a unit is destroyed, all its timeouts are automatically cleared:

```js
const unit = xnew((unit) => {
  xnew.timeout(() => {
    console.log('This will never execute');
  }, 5000);

  // Destroy after 1 second
  xnew.timeout(() => {
    unit.destroy(); // Automatically clears the 5-second timeout
  }, 1000);
});
```
