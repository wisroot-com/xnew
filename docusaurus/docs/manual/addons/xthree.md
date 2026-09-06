---
sidebar_position: 502
---

# xthree

`xthree` は xnew のライフサイクルを Three.js のシーングラフに統合するアドオンです。各コンポーネントが自身の 3D オブジェクトを保持し、unit が破棄されるとメッシュやライトはシーンから自動的に取り除かれます。

## セットアップ

### CDN
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

### npm
```bash
npm install @mulsense/xnew@0.9.x
```
```js
import { xnew } from '@mulsense/xnew'
import { xthree } from '@mulsense/xnew/addons/xthree'
```

## コア API

### `xthree.initialize({ canvas, camera? })`

ルートコンポーネントで一度だけ呼び出し、WebGL レンダラーを生成します。呼び出し後、次のプロパティにアクセスできます。
- `xthree.renderer` — `THREE.WebGLRenderer`
- `xthree.scene` — ルートの `THREE.Scene`
- `xthree.camera` — アクティブなカメラ
- `xthree.canvas` — `<canvas>` 要素

```js
function Main(unit) {
  const canvas = xnew('<canvas width="800" height="600">');
  xthree.initialize({
    canvas: canvas.current,
    camera: new THREE.PerspectiveCamera(60, 800 / 600, 0.1, 1000),
  });
  xthree.camera.position.set(0, 0, 10);

  unit.on('update', () => xthree.renderer.render(xthree.scene, xthree.camera));
}
```

### `xthree.nest(threeObject)`

`threeObject` を現在の Three.js 親オブジェクト（ルートの `scene`、または最も近い enclosing nest）の子として追加し、そのまま返します。unit が破棄されると、対象オブジェクトはシーンから自動的に取り除かれます。

さらに `nest` は **現在の親オブジェクトを `threeObject` に切り替えます**。そのため、子孫の unit で `nest` / `add` したものはこの `threeObject` の中に入ります。コンテナ（まとめて移動・回転させたい `Object3D` / `Group`）を作るときに使います。

```js
function Scene(unit) {
  const group = xthree.nest(new THREE.Object3D()); // 以降この group が親になる
  xnew(Box); // Box の中で nest したものは group の子になる

  unit.on('update', () => group.rotation.y += 0.01); // group ごと回る
}

function Box(unit) {
  const object = xthree.nest(new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x4488ff })
  ));
}
```

:::note
`nest` は親を切り替えるため、**同じ unit 内で `nest` を2回呼ぶと、2回目は1回目の子として入れ子になります**。同じ親の下に複数のオブジェクトを並べたいだけなら `add` を使ってください。
:::

### `xthree.add(threeObject)`

`threeObject` を現在の Three.js 親オブジェクトの子として追加し、そのまま返します。`nest` と違い **現在の親オブジェクトは変えません**。複数のオブジェクトを同じ親の下に兄弟として並べたいときに使います。unit 破棄時の自動除去は `nest` と同じです。

```js
function Lights(unit) {
  // どれも scene 直下の兄弟として追加される（互いに入れ子にならない）
  xthree.add(new THREE.AmbientLight(0xffffff, 1.0));
  const dir = xthree.add(new THREE.DirectionalLight(0xffffff, 1.5));
  dir.position.set(2, 5, 10);
}
```

:::note
`nest` / `add` した unit の破棄時は **detach のみ** で、GPU リソースは dispose されません。detach だけしたいときは Three.js 標準の `object.removeFromParent()` を使ってください。
:::
