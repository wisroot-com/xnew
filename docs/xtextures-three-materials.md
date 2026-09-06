# xtextures × three.js — 3 つのマテリアル方式の比較

> xtextures のプロシージャルテクスチャを three.js のメッシュに貼る方法は 3 つある。
> それぞれ何を得て何を捨てるかが違う。使い分けの判断基準としてここにまとめる。

## 3 方式

| | `material.shader()`<br>ShaderMaterial 注入 | `material.standard()`<br>ベイク | `material.standard({ inject: true })`<br>onBeforeCompile 注入 |
|---|---|---|---|
| 仕組み | 自前 ShaderMaterial に GLSL を注入 | color / normal を画像に焼いて map / normalMap に | standard の生成シェーダーに GLSL をパッチ |
| ライティング | ❌ 固定方向の偽ライト（シーンの光源・影は無効） | ✅ 完全（影・環境マップ・トーンマッピング） | ✅ 完全（影・環境マップ・トーンマッピング） |
| 解像度 | ✅ 無限（式をピクセルごとに評価） | ❌ 焼いた画像の解像度で固定 | ✅ 無限 |
| 座標 | オブジェクト空間の solid look（UV 不要・継ぎ目なし） | ジオメトリの UV に依存 | オブジェクト空間の solid look（UV 不要・継ぎ目なし） |
| パラメータのライブ変更 | ✅ `material.uniforms[name].value` | ❌ 焼き直しが必要 | ✅ `material.uniforms[name].value` |
| 毎フレームの GPU コスト | 高（ピクセルごとにノイズ評価） | **低（テクスチャ fetch 1 回）** | 高（ピクセルごとにノイズ評価） |
| 遠景の品質 | ⚠️ エイリアシング（mipmap なし） | ✅ mipmap / anisotropy が効く | ⚠️ エイリアシング（mipmap なし） |
| VRAM | 0 | 画像分 | 0 |
| 実装の安定性 | ✅ 自己完結 | ✅ 自己完結 | ⚠️ three 内部チャンク名に依存 |

## 使い分けの目安

- **ゲームシーンの大半 → ベイク（`standard()`）。** 安くて安定、影も mipmap も効く。
  床・壁・大量のオブジェクトは迷わずこれ。タイルが要るなら `tile: true` + `repeat`。
- **パラメータ調整 UI・UV のない形状のライブプレビュー → `shader()`。**
  ライティングが偽物なので、最終形の見た目確認には使わない。
- **inject が本当に効くのは「少数の主役」。** カメラが寄っても細部が潰れてほしくない
  ヒーローオブジェクト、UV 展開の面倒な形状に実ライティングで貼りたい場合、
  テクスチャパラメータをゲーム中に動かす演出。ベイクの置き換えではなく補完。

inject の代償は 3 つ:

1. **GPU コスト** — ノイズ評価をピクセルごとに毎フレーム払う（ベイクは fetch 1 回で同じ結果）。
2. **エイリアシング** — 式評価には mipmap がなく、遠くでチラつく
   （`fwidth` ベースの手動フィルタリングで緩和はできるが未実装）。
3. **壊れやすさ** — three の内部シェーダーチャンク名（`#include <map_fragment>` 等）への
   文字列パッチなので、three のバージョンアップで壊れ得る。この addon で唯一
   three 内部に依存する箇所。

## inject の実装メモ（src/addons/three/material.ts `injectStandard`）

`MeshStandardMaterial.onBeforeCompile` で生成済みシェーダーを文字列パッチする:

- **vertex**: `#include <common>` の後に varying（`vXtexPos` / `vXtexNormal` = オブジェクト空間の
  position / normal）を宣言し、`#include <begin_vertex>` の後で代入。
- **fragment**:
  - `#include <common>` の後にテクスチャ GLSL 一式 + 共有の接線フレーム（`glsl/frame.glsl` の
    `xtexTangent`。`shader()` 経路と同じものを使う）+ varying + `uniform mat3 normalMatrix;` を注入。
    normalMatrix は three の vertex プレフィックスにしか宣言されないが、renderer は uniform を
    名前でアップロードするので fragment 側の宣言でも同じ値が届く。
  - `#include <map_fragment>` の後で `diffuseColor.rgb = sRGB→linear(xtex<Name>Color(vXtexPos))`。
    プリセットの色はベイク画像と同じく表示（sRGB）空間で作られているので、
    ライティング前に linear へ変換しないとベイク版と明るさが合わない。
  - `#include <normal_fragment_maps>` を置き換え、`xtex<Name>Normal` の摂動法線
    （オブジェクト空間）を `normalMatrix` でビュー空間に回して `normal` に代入
    （両面材質のため `faceDirection` を掛ける）。
- **`customProgramCacheKey` が必須。** three は `onBeforeCompile.toString()` でプログラムを
  キャッシュするが、注入内容はクロージャ変数なのでソース文字列が全テクスチャで同一 →
  設定しないと wood と concrete が 1 つのシェーダーを共有してしまう。
- ライブパラメータ用に ShaderMaterial と同じ `material.uniforms` を生やしてある
  （`uniforms[name].value` への書き込みがコンパイル済みシェーダーに届く）。

## 動作デモ

`examples/2_addons/three_textures/` の display リストボックスで
shader / baked / inject を同一モデル・同一パラメータで切り替えて比較できる。
