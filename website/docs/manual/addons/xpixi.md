---
sidebar_position: 501
---

# xpixi

`xpixi` は xnew のライフサイクルを PixiJS のシーングラフに統合するアドオンです。各コンポーネントが自身の 2D オブジェクトを保持し、unit が破棄されるとシーンからも自動的に取り除かれます。

## セットアップ
### CDN
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

### npm
```bash
npm install @mulsense/xnew@0.9.x
```
```js
import { xnew } from '@mulsense/xnew'
import { xpixi } from '@mulsense/xnew/addons/xpixi'
```

## コア API

### `xpixi.initialize({ canvas })`

ルートコンポーネントで一度だけ呼び出し、PixiJS のレンダラーを生成します。呼び出し後、次のプロパティにアクセスできます。
- `xpixi.renderer` — PixiJS のレンダラー
- `xpixi.scene` — ルートの `PIXI.Container`
- `xpixi.canvas` — `<canvas>` 要素

```js
function Main(unit) {
  const canvas = xnew('<canvas width="800" height="600">');
  xpixi.initialize({ canvas: canvas.element });

  unit.on('update', () => xpixi.renderer.render(xpixi.scene));
}
```

### `xpixi.nest(pixiObject)`

`xnew.nest` の PixiJS オブジェクト版です。`pixiObject` を現在の親コンテナ（ルートの `scene`、または最も近い enclosing nest）に追加し、そのまま返します。unit が破棄されると、対象オブジェクトはシーンから自動的に取り除かれます。

さらに `nest` は **現在の親コンテナを `pixiObject` に切り替えます**。そのため、子孫の unit で `nest` / `add` したものはこの `pixiObject` の中に入ります（まとめて移動・表示制御したいコンテナを作るときに使う）。

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
`nest` は親を切り替えるため、**同じ unit 内で `nest` を2回呼ぶと、2回目は1回目の子として入れ子になります**。同じ親の下に複数のオブジェクトを並べたいだけなら `add` を使ってください。
:::

### `xpixi.add(pixiObject)`

`pixiObject` を現在の親コンテナの子として追加し、そのまま返します。`nest` と違い **現在の親コンテナは変えません**。複数のオブジェクトを同じ親の下に兄弟として並べたいときに使います。unit 破棄時の自動除去は `nest` と同じです。

```js
function Hud(unit) {
  // どちらも現在の親（例: scene）直下の兄弟として追加される
  xpixi.add(new PIXI.Graphics().rect(0, 0, 800, 40).fill(0x000000));
  const label = xpixi.add(new PIXI.Container());
  label.position.set(16, 8);
}
```

### `xpixi.remove(pixiObject)`

`pixiObject` をその時点の親から外して `destroy({ children: true })` で破棄します（`nest` / `add` した unit が破棄されるときの処理を、任意のタイミングで手動で行うもの）。texture は既定どおり温存されるので、共有テクスチャは壊れません。

```js
xpixi.remove(sprite); // 親から外して破棄
```
