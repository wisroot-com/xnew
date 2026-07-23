# TODO: xtextures — ゲーム用途向けの便利機能

> テクスチャの種類を増やすのとは別に、プロシージャルテクスチャを実際のゲームに投入する
> ためのパイプラインを整備する。

## API 再設計（前提）— ✅ 完了（2026-07-23）

`xtextures.Wood` のようなコンポーネント関数をやめ、`xtextures.wood` を
def + メソッドのプレーンなオブジェクトにした。

- メンバ: `glsl` / `color` / `normal` / `uniforms` （= TextureDef）+ `bake()` / `renderer()`
- 基本フローは 3 パターン:
  1. `bake()` — 画像（ImageBitmap）に焼き出す
  2. three.js にシェーダーを渡す（`xthree.texture(xtextures.wood, params)`）
  3. canvas にレンダリングする renderer を返す（`texture.renderer(canvas, options)`）

## 優先度高（着手順: 1 → 2 → 3）

### 1. ベイク API — ✅ 完了（2026-07-23）

- `texture.bake({ size, worldSize, channel, tile, params })` → ImageBitmap。
- 共有の OffscreenCanvas 1 枚 + プログラムキャッシュ（texture × channel × tile）で描画し、
  `transferToImageBitmap()` で同期的に取り出す。テクスチャごとに WebGL2 コンテキストを
  持たないので、ブラウザのコンテキスト上限（十数個）に当たらない。

### 2. three 標準マテリアルへの統合（PBR パス）— 🔶 ベイク経路は完了（2026-07-23）

- ✅ `xthree.bake(texture, { ...bakeOptions, repeat })` → THREE.CanvasTexture
  （channel に応じた colorSpace、anisotropy、repeat 指定で RepeatWrapping）。
- ✅ `xthree.standard(texture, { params, size, worldSize, tile, repeat, ...materialParams })`
  → color / normal を焼いて map / normalMap に組んだ MeshStandardMaterial。
- ⬜ `onBeforeCompile` で GLSL を standard マテリアルに注入する版（無限解像度のまま PBR）。
- ⬜ roughness / metalness / height をチャンネルとして TextureDef に追加できる設計
  （現状の color / normal の延長）。

### 3. シームレスタイリング — ✅ 完了（2026-07-23）

- `bake({ tile: true })` / `renderer(canvas, { tile: true })`。実装は周期ノイズではなく、
  ベイク時にラップした 4 サンプルを端 20% のバンドで smoothstep ブレンドする方式
  （runtime.ts `fragmentSource`）。テクスチャ側 GLSL の変更なしで全テクスチャに効く。
- 注意: 年輪のような大構造はバンド内でわずかにゴーストする。品質が要る場合の
  周期ノイズ（トーラス化 fbm）版は将来課題。

## 優先度中

### 4. プリセット

- テクスチャごとに名前付きパラメータセット（wood: oak / walnut / pine、
  concrete: smooth / rough など）。`uniforms` スキーマはただの JSON なので直列化も容易。
- examples の copy-params ボタン（調整値の固定）ワークフローの受け皿。

### 5. パラメータ調整ウィジェット（Tuner）

- `uniforms` の `min` / `max` / `step` からスライダー群を自動生成し、ライブ更新する
  xbasics 風コンポーネント。examples で手組みしている調整 UI を置き換える。

### 6. シードとバリエーション生成

- `seed` を全テクスチャの共通規約に昇格。
- シードだけ変えて複数枚ベイクするバリエーション生成（「同じ木目だが個体差のある
  床板を 20 枚」）を 1 行で。

## 優先度低〜将来

### 7. アニメーションテクスチャ対応

- `time` uniform を予約名とし、runtime / xthree アダプタが毎フレーム更新する仕組み。
- 水面・溶岩・エネルギーフィールド系テクスチャの前提。

### 8. xpixi 連携

- bake 結果を `PIXI.Texture` にする薄いヘルパー。2D ゲームから同じテクスチャ資産を使う。

### 9. レイヤー合成

- 2 つの def をマスクでブレンド（コンクリート + 汚れ等）。GLSL 合成の設計が重いので、
  チャンネル拡張（roughness 等）が落ち着いてから。
