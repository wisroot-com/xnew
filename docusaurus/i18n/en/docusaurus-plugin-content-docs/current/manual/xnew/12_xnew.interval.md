# xnew.interval

`xnew.interval` is `setInterval` with automatic cleanup. The interval stops on its own when the owning unit is destroyed — no need to stash the ID and call `clearInterval` manually.

## Usage

```js
const timer = xnew.interval(callback, duration, iterations);
```

**Parameters:**
- `callback`: Function to execute at each interval. Receives `{ count }` (`count` is the current iteration count, starting at `0`)
- `duration`: Time in milliseconds between executions
- `iterations` *(optional)*: number of times to run. `0` (default) means unlimited

**Returns:**
- A timer object with a `clear()` method to stop it

## Example

### Basic Counter

```js
xnew('<div>', (unit) => {
  let count = 0;
  unit.current.textContent = count;

  xnew.interval(() => {
    count++;
    unit.current.textContent = count;
  }, 1000); // Update every second
});
```

### Canceling an Interval

Call `clear()` on the returned timer to stop it. The callback receives the current iteration count as `count`.

```js
xnew('<div>', (unit) => {
  unit.current.textContent = 'Starting countdown...';

  const timer = xnew.interval(({ count }) => {
    unit.current.textContent = `Count: ${count + 1}`;

    // Stop after 10 iterations
    if (count + 1 >= 10) {
      timer.clear();
      unit.current.textContent = 'Countdown complete!';
    }
  }, 500);
});
```

## Automatic Cleanup

When a unit is destroyed, all its intervals are automatically cleared:

```js
const unit = xnew((unit) => {
  xnew.interval(() => {
    console.log('This will stop when unit is destroyed');
  }, 1000);
});

// Destroy after 5 seconds - interval automatically stops
xnew.timeout(() => {
  unit.destroy();
}, 5000);
```
