# tohoku_drop — 構造図

対象: [`script.js`](./script.js)

東北キャラのボクセルモデルを落として同じ種類を合体させ、スコアを競うスイカゲーム風アプリ。
Three.js（3Dモデル）を OffscreenCanvas に描画し、それを PixiJS のテクスチャに重ねて表示、
物理は matter-js で計算する（addon: xthree / xpixi / xmatter）。

---

## 全体構成

```mermaid
flowchart LR
    Main -->|xnew| Contents["Contents: シーンとデータの入れ物"]
    Contents -->|xnew| GameData["GameData: 全シーン共有のスコアデータ"]
    Contents -->|xnew| TitleScene["TitleScene: 最初のシーン"]
```

`Main` は描画パイプライン（three → pixi）と画面（`Screen`）を用意するだけ。
`Contents` が `GameData`（全シーンで共有するスコアデータ）と最初のシーン `TitleScene` を持つ。
以降、シーンは `TitleScene → GameScene → ResultScene → TitleScene …` と入れ替わる。

---

# TitleScene

## シーン内の構造

```mermaid
flowchart LR
    TitleScene -->|xnew| Background["Background: 背景画像スプライト"]
    TitleScene -->|xnew| ShadowPlane["ShadowPlane: 影を受ける床"]
    TitleScene -->|xnew| DirectionalLight["DirectionalLight: 影付きの平行光源"]
    TitleScene -->|xnew| AmbientLight["AmbientLight: 全体を照らす環境光"]
    TitleScene -->|xnew| Model["Model x7: 並んだキャラの3Dモデル id 0..6"]
    TitleScene -->|xnew| ThreeTexture["ThreeTexture: 3D描画を pixi テクスチャに合成"]
    TitleScene -->|xnew| TitleText["TitleText: タイトル文字 'とーほくドロップ'"]
    TitleScene -->|xnew| TouchMessage["TouchMessage: タップを促す表示"]
    TitleScene -->|xnew| VolumeControl["VolumeControl: 音量調整UI"]
```

## シーン遷移の条件

画面を `pointerdown`（タップ／クリック）すると `GameScene` へ遷移する。

---

# GameScene

## シーン内の構造

```mermaid
flowchart LR
    GameScene -->|xnew| Background["Background: 背景画像スプライト"]
    GameScene -->|xnew| ShadowPlane["ShadowPlane: 影を受ける床"]
    GameScene -->|xnew| DirectionalLight["DirectionalLight: 影付きの平行光源"]
    GameScene -->|xnew| AmbientLight["AmbientLight: 全体を照らす環境光"]
    GameScene -->|xnew| Bowl["Bowl: 玉を受ける皿(物理の壁)"]
    GameScene -->|xnew| Cursor["Cursor: 落下位置を示すカーソルと構え玉"]
    GameScene -->|xnew| Queue["Queue: 次に落とす玉のプレビュー"]
    GameScene -->|xnew| ThreeTexture["ThreeTexture: 3D描画を pixi テクスチャに合成"]
    GameScene -->|xnew| ScoreText["ScoreText: 現在スコアの表示"]
    GameScene -->|xnew| VolumeControl["VolumeControl: 音量調整UI"]
    GameScene -->|xnew| playing["playing: 匿名unit(BGM再生と操作受付)"]
    playing -->|xnew| Controller["Controller: 入力を +move/+drop に変換"]
```

## シーン遷移の条件

ボールが画面下まで落ちると `+gameover` イベントが発火し、`playing` を finalize して
スコア画像を撮影。約 2 秒後（`xnew.timeout`）に `ResultScene` へ遷移する（撮影画像を渡す）。

---

# ResultScene

## シーン内の構造

```mermaid
flowchart LR
    ResultScene -->|xnew| ResultBackground["ResultBackground: リザルト画面の背景"]
    ResultScene -->|xnew| xbasicsImage["xbasics.Image: ゲーム終了時のスクショ画像"]
    ResultScene -->|xnew| ResultDetail["ResultDetail: キャラ別スコアと合計の内訳"]
    ResultScene -->|xnew| ResultFooter["ResultFooter: タイトルに戻るボタン"]
```

## シーン遷移の条件

`ResultFooter` の戻るボタン（`onBack`）を押すと `TitleScene` へ戻る。

---

# ゲームプレイの主要コンポーネント

GameScene の遊びの中核は、`Cursor`・`Queue`・`ModelBall` が動的に `Model` や玉を
生成し合う部分にある。これらはイベント（`+drop` / `+reload` / `+gameover` 等）で連携する。

```mermaid
flowchart LR
    Cursor -->|xnew| CModel["Model: 構えている玉"]
    Cursor -->|"Scene.add (+drop時)"| ModelBall
    Queue -->|xnew| QModel["Model: 次の玉プレビュー"]
    ModelBall -->|xnew| MModel["Model: 落下中キャラの見た目"]
    ModelBall -->|"Scene.add"| StarParticles["StarParticles: 着地エフェクト"]
    ModelBall -->|"Scene.add (合体: id+1)"| ModelBall
```

- `Cursor` は `+drop` で `ModelBall` をシーンに追加し、`+reload` を発火して次の玉へ。
- `ModelBall` は `Circle`（matter-js の物理ボディ）を `extend` しており、同じ id 同士が接触すると
  両者を finalize し、`id+1` の `ModelBall` を生成する（合体）。落下しきると `+gameover` を発火。
- `Model` は voxelkit → VRM で読み込んだ 3D キャラ。Three.js 側に毎フレームアニメーションを与える。
