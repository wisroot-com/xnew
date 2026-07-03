# tohoku_shot 開発メモ

別セッションで再開するときの事前知識。コードの細部は変わるので、行番号より
「どこに何があるか」「なぜそうなっているか」を中心にまとめる。
（全体像は `script.js` 冒頭のコメントと各 `function` のコメントも参照）

---

## 1. ゲーム概要 / 世界観

縦シューティング。ストーリー:

- ずんだもんが放った**ずんだアロー**が誤って**中国うさぎ**に命中。
- うさぎ体内で**ずんだ因子**（東北キャラの姿をとる）が増殖する。
- プレイヤー＝**中国うさぎの免疫システム**（自機は後ろ向きの usagi）。
  ショットでずんだ因子を駆逐する。

敵＝ずんだ因子は4種（id順）:

| id | キャラ | vrm | base score | 分裂先 splitTo |
|----|--------|-----|-----------|----------------|
| 0 | ずんだもん | zundamon.vrm | 1 | なし |
| 1 | きりたん | kiritan.vrm | 2 | 0 |
| 2 | ずん子 | zunko.vrm | 4 | 1 |
| 3 | イタコ | itako.vrm | 8 | 2 |

上位の敵は被弾で**下位2体に分裂**する。自機は `usagi.vrm`（後ろ向き＝免疫視点）。

---

## 2. 実行方法（重要）

- このサンプルは **Laravel/Vite とは無関係**に静的配信される。`index.html` の importmap が
  `../../dist/` と `../../thirdparty/` を直接読む。**変更後はブラウザをリロードするだけ**。
- `script.js` は**バンドルされない**素の ES module。`node --check script.js` で構文確認できる。
- ライブラリ本体（`@mulsense/xnew` や addons）を変更したときだけ `npm run build` が必要
  （`dist/` → `examples/dist/` にコピーされる。`examples/dist/` は追跡対象）。
- xnew のビルド/テストは**ホストで動く**（Sail 不要）。`npx jest` / `npm run build`。
  ※ ルート CLAUDE.md の「Sail で実行」はこのパッケージには当てはまらない例外。
- ブラウザの console はこちらのログツールからは見えない。エラーは**スタックを直接貼ってもらう**のが速い。

---

## 3. アセット（`examples/assets/` 配下）

- 敵 VRM: `zundamon.vrm` `kiritan.vrm` `zunko.vrm` `itako.vrm`
- 自機 VRM: `usagi.vrm`
- うさぎイラスト（pixi スプライト, パネル/リザルト用）: `usagi00.png`(余裕) `usagi01.png`(普通) `usagi02.png`(焦り)
- ストーリー用: `usagi03.png`(被弾・目グルグル) `zunda_arrow.png`(ずんだアロー)
- 背景: `zunda_background.png`（やや暗めに加工して使用）
- BGM: `maou_bgm_cyber31.mp3`(ゲーム) / `st005.mp3`(リザルト, tohoku_drop と同じ)

---

## 4. シーンフロー

```
TitleScene ──tap/Space──▶ StoryScene ──2ページ目のtap/Space──▶ GameScene ──+gameover──▶ ResultScene
   ▲                         (1: 被弾 / 2: 因子増殖)                                         │
   └────────────戻る/Space（skipStory:true）────────────────────────────────────────────────┘
（戻ってきた TitleScene は skipStory:true → 次の tap/Space で StoryScene を飛ばし直接 GameScene へ）
```

- シーンは `xnew.extend(xbasics.Scene)` を使い、`unit.change(NextScene, props)` で遷移
  （兄弟として次を生成し自分を finalize）。`xnew.context(xbasics.Scene).add(Comp)` で子追加。
- どのシーンも先頭で `xnew(Background)` を呼ぶので、遷移しても背景が連続して見える。
- **進行入力はタップとスペースキー両対応**（Title 進行 / Story ページ送り / Result→Title）。
  各シーンで `unit.on('window.keydown', ...)` を `event.code==='Space' && !event.repeat` で拾う
  （`event.repeat` ガードで押しっぱなしの連続発火を防ぐ）。
- **skipStory**: `TitleScene(unit, { skipStory })`。リザルトから戻ると `change(TitleScene,{skipStory:true})`
  で渡し、Title の次の進行で `StoryScene` を飛ばして `GameScene` へ直行する。

### StoryScene（導入寸劇）

- `pages = [StoryPageHit, StoryPageSwarm]`。タップ/Space で送り、最終ページの入力で `GameScene` へ。
  ページ送りは `advance()` に集約し pointerdown と window.keydown(Space) の両方から呼ぶ（`busy` で 300ms ガード）。
- `StoryTheater`: 下部の黒帯（シアターモード風, 高さ 26cqw）。**セリフは全てこの帯の上に表示**する。
  pages より先に生成してテキストの背面に置く。上端はグラデでぼかし＋ピンクのアクセントライン。
- `StoryPageHit`: `zunda_arrow.png` が左から加速飛来 → `usagi03.png` に着弾。
  着弾で白フラッシュ + `+shake`（CameraShake 流用）+ うさぎぷるぷる + 矢が刺さって追従。
  キャラは黒帯の上（`CX=400, CY=215`、うさぎは `340/height` でやや大きめ）に中央寄せ配置。
- `StoryPageSwarm`: ベイク済み4キャラを `xnew.interval` で12体まで湧かせ、各 `StoryFactor` が
  ポップイン → 漂い + 拡縮ゆらぎ + 回転で「蠢く」。湧き範囲は黒帯に被らないよう上側（`by=90..360`）。
- セリフは `StoryDialog`（サイバー字幕フレーム）で表示。各ページが `accent`/`tag`/`bottomCqw`/`build` を渡し、
  `build` 内で `svgText` 本文を作る。フレーム＝ヘッダー（点滅● ＋ ▶TAG ＋ 流れる hex ＋ 装飾ライン）／
  四隅ブラケット＋ drop-shadow 発光／流れる解析フッター。黒帯（`StoryTheater`）には CRT 走査線も追加。
  ページ1は `sub`（着弾後フェードイン）を `build` のクロージャで掴むので、`build` は波括弧ブロックで undefined を返すこと。
- ページドット／「タップで進む」誘導（旧 `StoryOverlay`）は**廃止**（ユーザー要望で削除）。

---

## 5. キャラのベイク（VRM → AnimatedSprite）

`BakedCharacters` → `Baking`（各キャラ）→ `Model`。重い VRM をリアルタイム描画せず、
オフスクリーンで全フレームを焼いて `PIXI.Texture` 配列にし、`AnimatedSprite` で再生する。

- `Baking`: `xthree.initialize({ camera, canvas: new OffscreenCanvas(BAKE_FRAME_SIZE×2) })` +
  EffectComposer(RenderPass + SSAOPass + OutputPass)。毎 render tick で `batch` フレームずつ
  `composer.render()` → `transferToImageBitmap()` → **アトラス canvas に drawImage して即 `close()`**。
- **アトラス方式（2026-06-13〜）**: キャラ1体 = アトラス1枚（個別テクスチャにしない）。
  全フレームを1枚の canvas に敷き詰め、`PIXI.Texture.from(atlas).source` を共有する
  sub-texture（`new PIXI.Texture({ source, frame })`）の配列を `AnimatedSprite` に渡す。
  GPU テクスチャは計5枚、ImageBitmap は保持ゼロ。source 共有でバッチ描画も効く。
- **ベイク後の解放**: 完了時に `composer.dispose()` + `ssaoPass.dispose()` +
  `xthree.renderer.dispose()` + `forceContextLoss()` を明示的に呼ぶ
  （xthree の finalize は renderer を dispose しないため。クラッシュ対策の一部）。
- **シームレスループ**: `t` を `[0, 3π)` を `BAKE_FRAMES` 等分。回転は `t=3π` で 2π の倍数に戻り、
  ボーンの `sin(t × 偶数)` も開始位相へ戻る。**ここを触るときはループ条件を壊さないこと**
  （回転係数・ボーン係数を変えるなら t=3π で元に戻るか必ず確認）。
- パラメータ（モジュールレベル定数）: `BAKE_FRAMES=120`（再生周期は `BAKE_ANIMATION_SPEED =
  BAKE_FRAMES/360` で 360 枚時代と同じ約6秒に補正。**AnimatedSprite を作る場所では必ずこれを
  animationSpeed に設定する**）, `BAKE_FRAME_SIZE=96`, `batch`（1 tick で焼く枚数。
  大きいほど早く完成するが GPU スパイク大）。`spin:true`＝敵（くるくる回る）, `false`＝自機（後ろ向き固定）。
- テクスチャは**共有**（さらに source はキャラ内で共有）。破棄時に**テクスチャを destroy しない**こと
  （共有が壊れる）。`sprite.destroy()` の既定は texture を残す。

---

## 6. ゲームシステム

- **Wave**: `WaveManager`。`WAVE_GOALS = [1024,2048,3072,4096]`（index=wave-1）＝**その wave 内で稼ぐ目標スコア**。
  `ScoreManager.waveScore`（wave 毎に 0 リセット）が目標に達したら `nextWave()`
  → 現敵を `fadeOut()`（得点なし退場）→ `WaveTransition`（警告演出, 約2.8s）→ 次 wave。
  **wave4 はゲージは満タンになるが次へは進まない**（`wave < 4` ガード＝エンドレス）。
  ゲージ(`ScoreGauge`)は `waveScore / WAVE_GOALS[wave-1]` で、毎 wave 必ず 0% から貯まる。
  自動出現はその wave のキャラ1種だけ（下位は分裂で登場）。
  **wave1 も初回に `WaveTransition{wave:1}` を表示**してから開始。ただし `wave` は即 `1` に確定させ
  （`startWave(1)`、0 のままだとゲージ計算が壊れる）、湧きだけ `transitioning=true` で 2.8s 止める。
- **敵の出現**: 自動湧きは**画面上部20%（y∈[20,120]）に pop-in**（scale 0→1）。分裂はその場(x,y指定)に出す。
- **被弾/撃破** (`Enemy.clash(score, direction, fromStar)`):
  - `direction`＝当たった方向の単位ベクトル。これを軸に分裂方向・星の発射方向が決まる。
  - 倒された敵自身は `EnemyCorpse`（半透明に薄れて方向へノックバック）。
  - `splitTo` があれば下位2体を `invincible:true`（0.5s 半透明無敵）で生成。
  - 星 `Star`（チェーンショット）を `3+id` 個、扇状に発射。別の敵に当たると得点+2して連鎖。
    見た目は**くっきりした星スプライト**（回転＋キラキラ点滅＋フェード）。`vx/vy` は等速のまま（連鎖の到達距離を維持）。
  - カメラシェイクは**自機ショット命中時のみ**（`fromStar` のときは出さない）。
- **自機ショット `Shot` も星**（シアンの星、回転＋脈動）。挙動（上方向・命中判定 `<30`）は不変。
- **星は共有テクスチャ方式**: `starTexture()` が「不透明のくっきり星（5角・内半径0.45・縁取り）＋少しブラーをかけた淡いグロー」の
  RenderTexture を**一度だけ生成してキャッシュ**、`starSprite(color)` が `tint` を付けた **通常合成**の Sprite を返す
  （以前の加算合成オンリーは形が滲んで分かりにくかったので、コントラスト重視に変更）。`Shot`/`Star` が共用。
  同一テクスチャなのでバッチ描画が効き、Graphics 量産より GPU 負荷が低い（§9 のクラッシュ対策に配慮）。
  基準半径 `STAR_TEX_R=13`、スケールは `wantR / STAR_TEX_R`。**共有なので破棄時に texture を消さないこと**。
- **ショットエネルギー** `ShotEnergy`: 連射制限。`MAX=100 / COST=50`（満タンから2発）/
  `RECOVER=MAX/144`（約2.4s で全回復）。`tryConsume()` を Player が呼ぶ。
- **スコア** `ScoreManager`: `add(score, id)`。合計 `score`(sum) と wave 内 `waveScore`（`+wave` で 0 リセット）を
  別々に保持。`kills[id]` も集計（リザルトのキャラ別撃破数に使用）。リザルト表示は合計 `score`。

---

## 7. レイアウト定数

- キャンバスは 800×600（`Main` で `xbasics.Screen`）。
- `PANEL_W = 200` / `PLAY_RIGHT = 600`。**ゲーム領域は x ∈ [0, 600]**、右 200px は SidePanel。
  HTML 側の `25cqw`(=200/800) と一致させること。`cqw` はコンテナ幅基準（1cqw = 8px）。
- **当たり判定（自機⇄敵）**: `PLAYER_HIT_R=18` / `ENEMY_HIT_R=10`。中心間距離 `< 18+10=28` で被弾
  （旧 `< 28` と同値）。`Player`・`Enemy` がそれぞれ自分の半径でうっすら円を描く（重なる＝被弾と分かる）。
  円は `object` 直下に置きスプライトの拡縮の影響を受けない＝判定半径は一定。自機円はシアン＆明滅、敵円は赤で静的。
  ※ショット⇄敵は別判定（`Shot` 内の `< 30`、未変更）。
- **敵のスケールは時間変動**（`Enemy` update で `(基準) × (1 + sin(t*0.12+位相)*0.08)`）。生きて蠢く表現。
  ストーリー2ページ目の `StoryFactor` と同じ手法。
- `WAVE_COLORS = [0x9BE53C(黄緑), 0xC8923C(明るいこげ茶), 0x3FD96B(緑), 0xFFFFFF(白)]`。
  `waveColor(wave)` / `cssHex(n)`。ゲージ・レティクル・スコア・区切り線が wave 色に追従する。
- `ENEMY_CODES = ['ZD-0x01','KT-0x02','ZK-0x03','IT-0x04']`（敵 id ごとの識別コード）と
  `randHex(len)`（流れる謎文字用のランダム16進）はモジュールレベル共有。`TargetInfo` / `WaveTransition` が使う。
- `SidePanel` 構成: 上＝Wave 表示 / 中＝駆逐対象（ターゲットレティクル＋敵キャラ）/ 下＝うさぎ表情
  （画面内の敵数 30/60 で usagi00/01/02 をクロスフェード）。パネル背景は半透明（約50%）。
- **ターゲット表示はサイバー HUD**: `TargetReticle`（pixi）＝多重リング（逆回転）+ 回転レーダー掃引 +
  呼吸するロックオンブラケット + 周回ブリップ。`TargetInfo`（html）＝ヘッダー / 四隅の座標ラベル /
  円の左右を流れる hex レール / 下部の解析リードアウト（ID・SYNC バー・データストリーム）。
  リードアウトは自機イラスト上端に薄い暗幕を敷いて読ませている（`top: 25cqw` 付近）。
- **`WaveTransition` はサイバー警告画面**: HUD コーナーブラケット + 走査線 + グリッチした巨大 `WAVE N`
  （色収差シャドウ）+ `⚠ WARNING ⚠`（点滅）+ `THREAT Lv./ENTITY コード` + 縦走査ライン +
  下部の脅威解析バー（約 VISIBLE=126 フレームで 0→100%）+ 流れる hex。色は wave 連動。

---

## 8. xnew の規約・ハマりどころ

- **component の戻り値は defines になる**。`xnew('<div>', () => xnew(...))` のように
  波括弧なしのアロー関数は内側 `xnew(...)` の戻り（unit interface）を defines として返してしまい、
  `The property "element" already exists.` で落ちる。**子要素を作るだけなら必ず波括弧ブロック**:
  `xnew('<div>', () => { xnew(...); })`。defines を公開したいときだけ関数プロパティの object を return。
- **context 解決**: component は自身を**親に**context 登録する。よって「後から作られた兄弟」は
  祖先チェーンを辿って先に作られたものを `xnew.context(Comp)` で取得できる
  （例: `GameScene` で先に作った `ScoreManager`/`SoundFX`/`ShotEnergy` を Player 等が参照）。
  生成順に注意（参照される側を先に `xnew` する）。
- **`xnew.find(Comp)`** はグローバル検索（全 Enemy など）。
- **pixi 連携**: `xpixi.nest(obj)` でシーングラフに追加＆ unit finalize に連動。
  finalize で親から外して `destroy({children:true})`（テクスチャは温存）。
  → 多数生成するエフェクトはこの破棄に乗るので、手動 destroy で**共有テクスチャを壊さない**。
- **タイマー/トランジション**: `xnew.timeout(cb, ms)`, `xnew.interval(cb, ms)`（`.clear()`),
  `xnew.transition(({value})=>{}, ms, easing).timeout(cb)`。いずれも現在の unit に紐づき finalize で停止。
  easing は `'ease'` などが使える。
- **イベント**: `xnew.emit('+name', data)` でグローバル配信、`unit.on('+name', ...)`。
  入力は `Controller` が `+move`/`+shot` を emit。`+shake` は CameraShake、`+wave` は色追従系が購読。
- リザルトのキャプチャは `xpixi.renderer.extract.base64({ target: xpixi.scene, frame })`。
  pixi スプライトで描いたものは含まれ、HTML で描いたものは含まれない。

---

## 9. 既知の課題 / 保留中

- **ゲーム中の稀なページクラッシュ（〜10%）**: ユーザー報告。メモリ過剰ではなく、ベイク中でなく
  **ゲーム画面中**に落ちる。有力仮説は Star 連鎖時のバースト的な GPU 確保
  （特に `ScorePopup` が `new PIXI.Text(...)` を毎回生成＝グリフテクスチャの生成/破棄チャーン）。
  未実装の対策案: `ScorePopup` を BitmapText / HTML / プール化に置換 + 同時エフェクト数の上限。
  → **ユーザーが「様子見」中。勝手に着手しない**。再開時はまず再現条件とコンソールを確認。
  - **2026-06-13 調査**: 「リザルト画面に入った瞬間」にも落ちるとの追加報告を受けて原因分析。
    script.js 冒頭と `Main` に**一時診断コード**を導入済み（未捕捉例外 / unhandledrejection /
    webglcontextlost を赤帯表示+localStorage 保存、毎秒ハートビートで「タブごと死んだ」か
    「例外でループが死んだ」かを次回ロード時に区別）。原因確定後に削除する。
  - 静的解析の確定事実: (1) xnew の Ticker は callback が throw すると次の rAF を予約しない＝
    **update/render 中の例外1回でループ恒久停止**（=フリーズがクラッシュに見える）。
    (2) リザルト入りの瞬間は「ResultScene 同期構築（extract.base64×4 + mp3 デコード + tailwind JIT）
    → GameScene 全 pixi オブジェクトの一括 destroy」が同タイミングに集中。ゲームオーバー時にも
    全画面 extract.base64。 (3) 常駐負荷: ベイク済み 96×96 テクスチャ 1800 枚 + ImageBitmap 1800 個
    未 close + Baking の THREE.WebGLRenderer×5 が dispose されず残留（xthree に dispose 処理なし）。
    → 次の一手: クラッシュ1回分の診断出力（赤帯 or リロード後の表示）をユーザーに貼ってもらう。
  - **2026-06-13 観測**: クラッシュ時にエラー表示なし・ページが**自動リロード→即再クラッシュ→
    2回目で正常起動**。JS 例外ならスタックが赤帯に出るはずなので、**プロセスごと落ちる本物の
    ページクラッシュ（GPU/メモリ圧迫）が濃厚**。リロード直後の即死は、起動時が最重量
    （VRM ロード + ベイク: WebGL コンテキスト5本 + テクスチャ1800枚生成）なため圧迫が残ったまま
    再突入したと整合。診断コードを強化済み（ハートビートに scene/敵数/星数/JSヒープを毎秒記録、
    異常終了報告に直前状態を表示）。ResizeObserver loop 警告は無関係（除外済み）。
  - **ブラウザは Firefox**。クラッシュ後の再起動時に赤帯（前回セッション異常終了）が**出なかった**。
    Firefox の localStorage は遅延フラッシュのため、プロセスクラッシュで直近数秒〜セッション分の
    書き込みが失われ得る＝ハートビート方式はプロセスクラッシュに対して無力（JS 例外検出用としては有効）。
    この「何も残らない」挙動自体がプロセスクラッシュ説をさらに裏付け。
    → 決定的証拠は **about:crashes**（クラッシュレポートの signature / OOM 注記）で取る。
  - **2026-06-13 証拠調査の結論**: about:crashes 空・Firefox の pending minidump 空・macOS の
    クラッシュレポートも該当なし → **SIGKILL 型の死（メモリ圧迫キル等、レポートが残らない殺され方）**。
    実行環境は M3 MacBook Air 16GB（ユニファイドメモリ＝GPU 確保がそのまま RAM を食う）で、
    Docker VM + VS Code 常駐により恒常的にメモリ逼迫（6/8 の JetsamEvent 時点で空き 64MB）。
    JS 例外説（診断無反応）・segfault 説（minidump なし）は棄却。メモリ/GPU 圧迫説で全観測が整合。
  - **2026-06-13 対策実装**（ユーザー承認済み）: ①ベイク後に composer/ssaoPass/renderer を
    dispose + `forceContextLoss()`（WebGL コンテキスト5本と VRM の GPU リソースを解放）
    ② `BAKE_FRAMES` 360→120 ③ **アトラス化**（§5 参照。GPU テクスチャ 1800枚→5枚、
    ImageBitmap 1800個→0）。効果検証中：クラッシュ頻度の変化を観察。
    未着手: ScorePopup の PIXI.Text チャーン対策 / 敵数上限（再発するなら次の手）。
  - **2026-06-13 後始末**: 一時診断コード（diagReport / ハートビート / webglcontextlost 捕獲）は
    **削除済み**。再発時に再投入するなら git 履歴（この日のコミット周辺）から復元できる。
  - **2026-06-14 真因判明 — 「クラッシュ」の正体は Live Server の自動リロードだった**:
    three_simple / three_mog / tohoku を数分放置すると落ちる件を再調査。**実測で全容疑を棄却**した:
    JS ヒープ平坦（ヘッドレスで30万フレーム≒83分相当でも +0MB）／クラッシュ時間帯も全 Firefox
    プロセスの RSS 平坦／jetsam・crash report・minidump・GPU/Metal ログすべて空／メモリ空き50%超。
    「クラッシュ」の署名＝**JS例外なし・webglcontextlost なし・プロセス死なし・console だけリセット**
    ＝クラッシュではなく**ページ reload（ナビゲーション）**。決定実験: ①xnew を使わない素の three.js
    でも同様に発生（→ xnew 無実）、②素の静的サーバ（`python3 -m http.server`、注入スクリプトなし）
    で開くと**発生しない**、③served ファイルを `touch` しただけで reload を再現。
    → **原因は VS Code の Live Server**。既定でワークスペース全体（`.git` 含む）を監視し、ファイル
    イベントで開いているページを reload する。発火源は Sail/Laravel/vite/pail のログ・生成物、git、
    VS Code/エディタ活動、`.DS_Store` 等。**xnew・xthree・本ゲームのコードは無関係**（リーク無し）。
    対策: リポジトリ root の `.vscode/settings.json` に `liveServer.settings.ignoreFiles` を追加済み
    （`.git`/`storage`/`dist`/`node_modules`/`.DS_Store`/Wayfinder 生成物/`*.log` を除外）。
    WebGL 例は素サーバ（`npx serve` 等）で開くのが最も確実。
    **注意**: 上記「ゲーム中の稀なクラッシュ（〜10%・操作中）」が同一原因（Live Server reload）か
    どうかは未確定。アイドル放置クラッシュは Live Server で確定だが、操作中の落ちは別要因の可能性も
    残る。再発時はまず素サーバ／ignoreFiles 適用後に再現するかで切り分けること。
    §9 上部の「GPU/メモリ圧迫が濃厚」とした 2026-06-13 の結論は、少なくともアイドル放置分については
    Live Server 誤認だった可能性が高い。
- `Baking` の `batch` 値はパフォーマンス調整の対象（過去に 6 と 100 で揺れた）。
  触る前に現在値を確認し、ループのシームレス性を壊さないこと。

### リファクタリング（2026-06-13）

冒頭に小さなヘルパーを集約した（挙動は不変）。新規コードはこれらを使うこと:
- `asset(name)` … `../../assets/${name}`。アセット読み込みは全部これ経由。
- `enemyIdForWave(wave)` … その wave の主役敵 id（`Math.min(wave-1, 3)`）。WaveManager /
  WaveEnemyDisplay / TargetInfo が共用。`waveColor()` は別概念（色）なので分離したまま。
- `svgText(text, fontSize, stroke?, strokeWidth?)` … `xbasics.SVGText` の縁取りテキスト
  ラッパー（`className:'inline-block'` 固定。stroke 既定 `#EEEEEE` / strokeWidth 既定 `0.2cqw`）。
- `ResultBackground` 内の白丸 2 ループは局所関数 `floatingCircle(size, transform)` に集約。

---

## 10. 関連メモ（~/.claude メモリ）

- `xnew-component-return-is-defines` … 上記 §8 の戻り値ハマりの詳細。
- `xnew-tests-run-on-host` … テスト/ビルドはホストで（Sail 不要）。
- `xnew-website-bilingual-docs` … website は ja+en 二言語。

---

## 11. コンポーネント早見（`grep -n "^function" script.js` で最新を確認）

- 基盤: `Main` `Contents` `BakedCharacters` `Baking` `Model`
- シーン: `TitleScene`(`TitleCharacters`/`TitleFactor`＝中央うさぎ+周囲で蠢く敵4体)
  `StoryScene`(`StoryTheater`/`StoryPageHit`/`StoryPageSwarm`/`StoryFactor`)
  `GameScene` `ResultScene`
- Wave: `WaveManager` `WaveTransition` `WaveLabel`
- パネル: `SidePanel` `PanelBackdrop` `WaveEnemyDisplay` `TargetReticle` `TargetInfo` `UsagiFace`
- 背景: `Background` `BackgroundBase` `Mote` `PulseGlow`
- 自機/弾/敵: `Player` `Shot` `Enemy` `Star` `ScorePopup` `EnemyCorpse` `PlayerExplosion`
- 演出/音/UI: `HitBurst` `CameraShake` `ShotEnergy` `SoundFX` `ScoreManager` `ScoreGauge` `GameOverText`
- リザルト: `ResultBackground` `ResultImage` `ResultDetail` `ResultFooter` `ScreenShot`
- ヘルパー: `VolumeControl` `TitleText` `TouchMessage` `Camera` `ArrowUturnLeft`
