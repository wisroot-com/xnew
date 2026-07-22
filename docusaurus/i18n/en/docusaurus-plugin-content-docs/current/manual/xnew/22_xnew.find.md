# xnew.find

`xnew.find` returns every currently active unit created with a given component function. It's the quickest way to broadcast to all enemies, sync all counters, or run collision detection against every moving object — without maintaining manual arrays.

## Usage

```js
const units = xnew.find(Component);          // every matching unit
const [unit] = xnew.find(Component, { key }); // narrow to one by the reserved `key` prop
```

**Parameters:**
- `Component`: The component function to search for
- `opts.key` *(optional)*: narrow to the unit whose reserved `key` prop (set at creation via `xnew(Component, { key })`) matches

**Returns:**
- An array of the currently active units that match

## Example

### Basic Usage

```js
function Counter(unit) {
  xnew.nest('<div>');
  let count = 0;
  unit.element.textContent = count;

  return {
    increment() {
      count++;
      unit.element.textContent = count;
    }
  };
}

// Create multiple counters
const counter1 = xnew(Counter);
const counter2 = xnew(Counter);
const counter3 = xnew(Counter);

// Find all Counter units
const allCounters = xnew.find(Counter);
console.log(allCounters.length); // 3

// Increment all counters at once
allCounters.forEach(counter => counter.increment());
```

### Managing Multiple Instances

```js
function Player(unit, { name }) {
  xnew.nest('<div>');
  unit.element.textContent = `Player: ${name}`;

  let score = 0;

  return {
    addScore(points) {
      score += points;
      unit.element.textContent = `Player: ${name} - Score: ${score}`;
    },
    getScore() {
      return score;
    }
  };
}

// Create players
xnew(Player, { name: 'Alice' });
xnew(Player, { name: 'Bob' });
xnew(Player, { name: 'Charlie' });

// Find all players
const players = xnew.find(Player);

// Add points to all players
players.forEach(player => player.addScore(10));

// Calculate total score
const totalScore = players.reduce((sum, player) => sum + player.getScore(), 0);
console.log('Total score:', totalScore); // 30
```

## Use Cases

- **Coordinating multiple instances** — update or control all instances of a component type
- **State synchronization** — keep multiple components in sync
- **Broadcasting** — send messages or events to all instances
- **Cleanup operations** — find and remove all instances of a component
- **Statistics and monitoring** — count or analyze active components

Only currently active units are returned; finalized units are excluded.
