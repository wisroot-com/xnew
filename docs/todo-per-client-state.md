# TODO: プレイヤーごとに異なる state ビュー（宛先別の投影）

> 現状の xsync は「サーバ権威 + ルーム全員に同一の state tree を同報」。
> ボードゲームに必要な**非公開情報**（手札・役職）を state として扱えない。その解消。

## 1. なぜ必要か

### 1-1. ボードゲームの本質は「隠された情報」

mulpia が載せるゲームの規格の中心はボードゲームであり、その面白さの多くは**隠された情報**から生まれる。

| ゲーム | 隠されているもの |
|---|---|
| 一般的なカードゲーム | 手札、山札の順序 |
| 人狼 | 各プレイヤーの役職 |
| Just One | 他のプレイヤーが書いた答え（一斉公開まで） |
| コードネーム | スパイマスターだけが見る正解の配置 |

**「自分だけが見えて、他人には見えない情報」を配れないと、これらは一つも作れない。**

### 1-2. クライアントで隠すのは不可能

「全員に送っておいて、クライアント側で表示しない」は成立しない。ブラウザの DevTools で payload が丸見えになり、不正の温床になる。**サーバが送らないこと**でしか秘匿できない。

### 1-3. 現状は「隠せる」が「配れない」

| できること | 実現方法 |
|---|---|
| 誰にも配らない状態を持つ | `xsync.server(() => { ... })` のクロージャ変数。同期対象は `xsync.state` だけなので外に出ない |
| 特定の socket にイベントを送る | `xsync.emitToClients(type, props, ids)`（`src/sync/xsync.ts` の `relayToClients`） |

| できないこと | 理由 |
|---|---|
| **特定のプレイヤーにだけ見える state を宣言する** | `captureStateTree()` は update ごとに **1 回だけ**計算され、`io.to(room.id).emit('sync', ...)` でルーム全員に同報される。**宛先ごとに tree を作り分けるフックが無い** |

### 1-4. 落とし穴 —「register しなければ隠せる」は誤り

state tree は**サーバ側の registry** で作られる。クライアント側で当該コンポーネントを register していなくても、`applyStateTree` が unit 生成をスキップするだけで、**payload はワイヤに乗り DevTools から見える**。

### 1-5. 手動チャネルでは足りない

`emitToClients` を秘匿チャネルとして使えば実装自体は可能。ただし毎回、以下を自前で書くことになる。

- **再送** — 遅延参加・再接続・リロード時の復元（`emitToClients` は fire-and-forget）
- **差分** — 変わるたびに全量を手で送る
- **検証** — 偽装イベントの排除

そして最大の問題は、**秘匿情報を誤って `xsync.state` に入れた瞬間に全員へ漏れること**。仕組みで防げず、レビューに依存する。外部の作家がゲームを作るフェーズで必ず破綻する。

## 2. 方針

**`captureStateTree()` を `(clientId) => SyncNode[]` に一般化し、接続中の socket ごとに投影して個別 emit する。**

- 個別送信の下地は既にある（`relayToClients` の `info.io.to(cid).emit(...)`）
- 可視性を**state の宣言そのものに持たせる**ことで、漏洩を構造的に防ぐ

### 現状のコード（`src/sync/xsync.ts`）

```
root.on('update', () => io.to(room.id).emit('sync', captureStateTree()))   // 全員に同じ tree
```

### 変更後のイメージ

```
root.on('update', () => {
    for (const clientId of clients) {
        io.to(clientId).emit('sync', captureStateTree(clientId));   // 宛先ごとに投影
    }
})
```

## 3. 設計上の論点（未決）

**投影のルールをどこに、どう書くか。** これが本 TODO の肝。

| 案 | 書き方のイメージ | 論点 |
|---|---|---|
| **state 宣言に可視性を持たせる** | `xsync.state({ cards }, { visibleTo: ownerId })` | 宣言的で分かりやすい。動的に可視範囲が変わる場合（一斉公開）をどう表現するか |
| **ノード単位の投影関数** | `xsync.project((state, clientId) => ...)` | 柔軟だが、書き忘れると漏れる（デフォルトが危険側） |
| **公開/非公開を別 state に分ける** | `xsync.state({...})` と `xsync.privateState(ownerId, {...})` | 誤って公開側に入れる事故は残る |

**デフォルトは安全側に倒すべきか？**（宣言しない限り配らない ＝ opt-in）——安全だが、既存サンプルが全部壊れる。

### 併せて検討すること

- **パフォーマンス** — 毎 update で人数分の tree を作る。3〜10人規模なら許容範囲と推測されるが、差分計算が要るか要検証
- **再接続・遅延参加** — 投影が state 層に入れば、`sync.connect` 時の再送は自動的に解決する（手動チャネルの弱点が消える）

## 4. 併せて塞ぐべきセキュリティホール

**クライアント発の `emitToClients` を、サーバが検証なしで中継している。**

`src/sync/xsync.ts` のサーバ側 handler が、クライアントから来た `payload.ids` と `payload.data` をそのまま `relayToClients` に渡している。クライアントは任意の `type` / `ids` / `data` を注入できる。

**人狼で他人になりすまし、偽の役職通知を送れる。** 秘匿情報を扱うなら必須の修正。

## 5. 現状の確認事項

- `basics.Lobby` / `basics.Room` は**存在しない**。Lobby / Room は examples 側の自前実装（`examples/1_xnew/sync/multiplay/server.js`）
- 秘匿情報を扱う既存サンプル・テストは**無い**
- 個別送信のテストは1件のみ（`test/sync/to-server-client.test.ts` の「emitToClients with ids」）
- `docs/multiplayer-state-sync-design.md` は「サーバーロジックのクライアント非配布（チート対策）」を**スコープ外**と明記している。**本 TODO はその前提を変更するもの**
