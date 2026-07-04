---
sidebar_position: 1
---

# get started

**Your first 10 minutes with xnew.**

## What is xnew?

`xnew` is a JavaScript / TypeScript library for component-oriented programming.

The key features:

- **Component-oriented** — each feature of your application is implemented as a self-contained component. Components automatically wire themselves together, so you can build without worrying about how they interact.
- **Game-ready addons** — official integrations for PixiJS, Three.js, matter-js, and Rapier let you build complex interactive apps and games on the same model.

## Setup

Choose one of the following methods to include xnew in your project:

### Via CDN
Use the ES module version with an import map:
```html
<script type="importmap">
{
  "imports": {
    "@mulsense/xnew": "https://unpkg.com/@mulsense/xnew@0.9.x/dist/xnew.mjs"
  }
}
</script>

<script type="module">
import { xnew } from '@mulsense/xnew';

// Your code here
</script>
```

### Via npm
Install `xnew` using npm:
```bash
npm install @mulsense/xnew@0.9.x
```

Then import it in your JavaScript file:
```js
import { xnew } from '@mulsense/xnew';
```

## Tutorial

### Basic Syntax
There are two main ways to use `xnew`:

#### 1. Creating Components
```js
const unit = xnew(Component, props);

function Component(unit, props) {
  // Define behavior here
  // props = data passed to the component
}
```

#### 2. Creating HTML Elements
```js
const unit = xnew('<div class="my-class">', 'inner text');
unit.element; // Access the created DOM element
```

### Example 1: Your First Component

A minimal example that creates a single component and displays a message:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script type="importmap">
  {
    "imports": {
      "@mulsense/xnew": "https://unpkg.com/@mulsense/xnew@0.9.x/dist/xnew.mjs"
    }
  }
  </script>
</head>
<body>
  <script type="module">
    import { xnew } from '@mulsense/xnew';
    // Create your first component
    xnew(MyFirstComponent);

    function MyFirstComponent(unit) {
      // Create a simple paragraph element
      xnew('<p>', 'Hello, xnew!');
    }
  </script>
</body>
</html>
```

This will generate:
```html
<body>
  <p>Hello, xnew!</p>
</body>
```

### Example 2: Creating Multiple Elements

`xnew.nest()` shifts the nesting context so subsequent elements are placed inside a container. This is how you build structured layouts without writing a wall of HTML:

<iframe style={{width:'100%',height:'120px',border:'solid 1px #DDD',borderRadius:'6px'}} src="/xnew/1_xnew/manual/element.html" ></iframe>

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script type="importmap">
  {
    "imports": {
      "@mulsense/xnew": "https://unpkg.com/@mulsense/xnew@0.9.x/dist/xnew.mjs"
    }
  }
  </script>
</head>
<body>
  <script type="module">
    import { xnew } from '@mulsense/xnew';
    // Create main component
    xnew(MainComponent);

    function MainComponent(unit) {
      // Create a paragraph element
      xnew('<p>', 'Create new HTML elements.');
    
      // Create a child component
      xnew(ColorBoxes);
    }

    function ColorBoxes(unit) {
      // Create a container and nest child elements inside it
      xnew.nest('<div style="display: flex;">');

      // The following elements will be nested inside the container
      xnew('<div style="width: 160px; height: 36px; background: #d66;">', '1');
      xnew('<div style="width: 160px; height: 36px; background: #6d6;">', '2');
      xnew('<div style="width: 160px; height: 36px; background: #66d;">', '3');
    }
  </script>
</body>
</html>
```

This generates:
```html
<body>
  <p>Create new HTML elements.</p>
  <div style="display: flex;">
    <div style="width: 160px; height: 36px; background: #d66;">1</div>
    <div style="width: 160px; height: 36px; background: #6d6;">2</div>
    <div style="width: 160px; height: 36px; background: #66d;">3</div>
  </div>
</body>
```

**Key concepts:**
- `xnew.nest()` creates a container element and nests subsequent elements inside it
- Components can call other components to organize your code
- Each component is a reusable function

### Example 3: Adding Interactivity

Click the box below to start and stop a CSS rotation animation.

<iframe style={{width:'100%',height:'300px',border:'solid 1px #DDD',borderRadius:'6px'}} src="/xnew/1_xnew/manual/box.html" ></iframe>

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script type="importmap">
  {
    "imports": {
      "@mulsense/xnew": "https://unpkg.com/@mulsense/xnew@0.9.x/dist/xnew.mjs"
    }
  }
  </script>
</head>
<body>
  <script type="module">
    import { xnew } from '@mulsense/xnew';
    xnew(RotatingBox);

    function RotatingBox(unit) {
      // Create a centered blue box and nest content inside it
      xnew.nest('<div style="position: absolute; width: 200px; height: 200px; inset: 0; margin: auto; background: #08F; cursor: pointer;">');
      
      // Add text inside the box
      const text = xnew('<span style="color: white; font-size: 24px; display: flex; justify-content: center; align-items: center; height: 100%;">');

      // Handle click events - toggle the rotation
      let running = false;
      unit.on('click', ({ event }) => {
        running = !running;
        text.element.textContent = running ? 'start' : 'stop';
      });

      // Update animation frame
      let rotate = 0;
      unit.on('update', () => {
        if (running === false) return;
        rotate++;
        unit.element.style.transform = `rotate(${rotate}deg)`;
      });
    }
  </script>
</body>
</html>
```

**Key concepts:**
- `unit.on()` adds event listeners to your component
- DOM events such as `click` fire in response to user interaction
- The 'update' event fires every frame

## Next Steps

You now know everything to start building with xnew. Here's where to go next:

1. **[xnew — xnew](./xnew/xnew)** — full API reference: events, lifecycle, custom methods, and more
2. **[xnew — xnew.timeout / interval / transition](./xnew/xnew.timeout)** — timers with automatic cleanup and chainable transitions
3. **[Addons — xpixi / xthree](./addons/xpixi)** — drop-in PixiJS and Three.js integration
