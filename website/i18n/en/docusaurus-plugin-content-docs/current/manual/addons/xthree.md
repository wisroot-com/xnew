---
sidebar_position: 502
---

# xthree

`xthree` bridges xnew's component lifecycle with Three.js's scene graph. Components own their 3D objects — when a unit is destroyed, its meshes and lights are removed from the scene automatically.

## Setup

### Via CDN
```html
<script type="importmap">
{
  "imports": {
    "@mulsense/xnew": "https://unpkg.com/@mulsense/xnew@0.9.x/dist/xnew.mjs",
    "@mulsense/xnew/addons/xthree": "https://unpkg.com/@mulsense/xnew@0.9.x/dist/addons/xthree.mjs"
  }
}
</script>

<script type="module">
import { xnew } from '@mulsense/xnew'
import { xthree } from '@mulsense/xnew/addons/xthree'

// ...
</script>
```

### Via npm
```bash
npm install @mulsense/xnew@0.9.x
```
```js
import { xnew } from '@mulsense/xnew'
import { xthree } from '@mulsense/xnew/addons/xthree'
```

## Core API

### `xthree.initialize({ canvas, camera? })`

Call once in the root component to create the WebGL renderer. After this you have access to:
- `xthree.renderer` — the `THREE.WebGLRenderer`
- `xthree.scene` — the root `THREE.Scene`
- `xthree.camera` — the active camera
- `xthree.canvas` — the `<canvas>` element

```js
function Main(unit) {
  const canvas = xnew('<canvas width="800" height="600">');
  xthree.initialize({
    canvas: canvas.element,
    camera: new THREE.PerspectiveCamera(60, 800 / 600, 0.1, 1000),
  });
  xthree.camera.position.set(0, 0, 10);

  unit.on('update', () => xthree.renderer.render(xthree.scene, xthree.camera));
}
```

### `xthree.nest(threeObject)`

Adds `threeObject` as a child of the current Three.js parent (the root `scene`, or the nearest enclosing nest) and returns it. When the unit is destroyed, the object is removed from the scene automatically.

In addition, `nest` **makes `threeObject` the current parent**. Anything `nest`-ed or `add`-ed in descendant units therefore goes inside this `threeObject`. Use it to build a container (an `Object3D` / `Group` you want to move or rotate as a whole).

```js
function Scene(unit) {
  const group = xthree.nest(new THREE.Object3D()); // group becomes the current parent
  xnew(Box); // whatever Box nests goes inside group

  unit.on('update', () => group.rotation.y += 0.01); // the whole group rotates
}

function Box(unit) {
  const object = xthree.nest(new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x4488ff })
  ));
}
```

:::note
Because `nest` switches the current parent, **calling `nest` twice in the same unit nests the second object inside the first**. If you just want several objects under the same parent, use `add`.
:::

### `xthree.add(threeObject)`

Adds `threeObject` as a child of the current Three.js parent and returns it. Unlike `nest`, it **does not change the current parent**. Use it to place several objects as siblings under the same parent. Automatic removal on unit destroy works the same as `nest`.

```js
function Lights(unit) {
  // all added as siblings directly under scene (not nested into each other)
  xthree.add(new THREE.AmbientLight(0xffffff, 1.0));
  const dir = xthree.add(new THREE.DirectionalLight(0xffffff, 1.5));
  dir.position.set(2, 5, 10);
}
```

### `xthree.remove(threeObject)`

Detaches `threeObject` from its current parent (**detach only**). It does **not** dispose geometry / material / texture, because those resources may be shared across models or cached by the app. Useful when swapping models through a single rig: call it before mounting the next model.

```js
// bake several VRMs through one rig
rig.add(vrm.scene);
// …render / bake…
xthree.remove(vrm.scene); // detach from the rig (resources kept)
```

:::note
When a unit that called `nest` / `add` is destroyed, the object is likewise only **detached** — GPU resources are not disposed.
:::

### `xthree.dispose(threeObject)`

Detaches `threeObject` from its parent and traverses its descendants, calling `dispose()` on geometry / material / texture to **explicitly free all GPU resources**. Assumes the textures and other resources are not shared with other objects — calling it on shared resources can break the rendering of other live models.

```js
// when you know the resources belong to this model alone
xthree.dispose(model); // detach and free geometry/material/texture
```
