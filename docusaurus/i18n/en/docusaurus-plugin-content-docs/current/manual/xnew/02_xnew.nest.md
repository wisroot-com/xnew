# xnew.nest

`xnew.nest` creates a child element and shifts `unit.current` to point to it. Any elements created after the call are placed inside the new element automatically — no manual parent references needed.

## Usage

```js
const element = xnew.nest(tag);
```

**Parameters:**
- `tag`: HTML string to create the element (e.g., `'<div>'`, `'<span class="highlight">'`)

**Returns:**
- The newly created HTMLElement (`unit.current` also now points to this element)

## How It Works

`xnew.nest` creates the new element as a child of the current element and shifts the context so that subsequent `xnew()` calls land inside it. Wrap a block in `xnew(() => { ... })` to limit the shift to that scope — the parent level is restored when the inner function returns.

## Example

### Basic Nesting

```js
xnew((unit) => {
  // Initially, unit.current is document.body

  xnew.nest('<header>');
  // Now unit.current === header

  xnew('<h1>', 'Welcome');
  // h1 is created inside header
});

// Result:
// <header>
//   <h1>Welcome</h1>
// </header>
```

### Managing Nesting Levels

```js
function Card(unit, { title, content }) {
  xnew.nest('<div class="card">');
  unit.current.style.border = '1px solid #ddd';
  unit.current.style.padding = '15px';

  // Create and immediately exit header
  xnew((unit) => {
    xnew.nest('<div class="card-header">');
    unit.current.style.fontWeight = 'bold';
    unit.current.textContent = title;
  });
  // After the nested xnew, we're back to the card level

  // Create body at card level
  xnew((unit) => {
    xnew.nest('<div class="card-body">');
    unit.current.textContent = content;
  });
}

xnew(Card, {
  title: 'My Card',
  content: 'This is the card content'
});

// Result:
// <div class="card">
//   <div class="card-header">My Card</div>
//   <div class="card-body">This is the card content</div>
// </div>
```

Nested elements are removed when the parent unit is destroyed.
