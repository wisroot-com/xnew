---
sidebar_position: 501
---

# xpixi

`xpixi` bridges xnew's component lifecycle with PixiJS's scene graph. Components own their 2D objects — when a unit is destroyed, its objects are removed from the scene automatically.

## Setup
### Via CDN
```html
<script type="importmap">
{
  "imports": {
    "@mulsense/xnew": "https://unpkg.com/@mulsense/xnew@0.9.x/dist/xnew.mjs",
    "@mulsense/xnew/addons/xpixi": "https://unpkg.com/@mulsense/xnew@0.9.x/dist/addons/xpixi.mjs"
  }
}
</script>

<script type="module">
import { xnew } from '@mulsense/xnew'
import { xpixi } from '@mulsense/xnew/addons/xpixi'

// ...
</script>
```

### Via npm
```bash
npm install @mulsense/xnew@0.9.x
```
```js
import { xnew } from '@mulsense/xnew'
import { xpixi } from '@mulsense/xnew/addons/xpixi'
```

## Core API

### `xpixi.initialize({ canvas })`

Call once in the root component to create the PixiJS renderer. After this you have access to:
- `xpixi.renderer` — the PixiJS renderer
- `xpixi.scene` — the root `PIXI.Container`
- `xpixi.canvas` — the `<canvas>` element

```js
function Main(unit) {
  const canvas = xnew('<canvas width="800" height="600">');
  xpixi.initialize({ canvas: canvas.current });

  unit.on('update', () => xpixi.renderer.render(xpixi.scene));
}
```

### `xpixi.nest(pixiObject)`

Analogous to `xnew.nest` but for PixiJS objects. Adds `pixiObject` to the current parent container (the root `scene`, or the nearest enclosing nest) and returns it. When the unit is destroyed, the object is removed from the scene automatically.

In addition, `nest` **makes `pixiObject` the current parent**. Anything `nest`-ed or `add`-ed in descendant units therefore goes inside this `pixiObject` (use it to build a container you move or toggle as a whole).

```js
function Enemy(unit) {
  const object = xpixi.nest(new PIXI.Container());
  object.position.set(100, 200);

  const gfx = new PIXI.Graphics().circle(0, 0, 20).fill(0xFF4444);
  object.addChild(gfx);

  unit.on('update', () => {
    object.y += 2; // move down each frame
    if (object.y > 600) unit.finalize(); // auto-cleanup when off screen
  });
}
```

:::note
Because `nest` switches the current parent, **calling `nest` twice in the same unit nests the second object inside the first**. If you just want several objects under the same parent, use `add`.
:::

### `xpixi.add(pixiObject)`

Adds `pixiObject` as a child of the current parent container and returns it. Unlike `nest`, it **does not change the current parent**. Use it to place several objects as siblings under the same parent. Automatic removal on unit destroy works the same as `nest`.

```js
function Hud(unit) {
  // both added as siblings under the current parent (e.g. scene)
  xpixi.add(new PIXI.Graphics().rect(0, 0, 800, 40).fill(0x000000));
  const label = xpixi.add(new PIXI.Container());
  label.position.set(16, 8);
}
```
