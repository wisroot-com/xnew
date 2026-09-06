# xsync

`xsync` は xnew のネットワーク同期レイヤーです。**サーバーが唯一の真実（source of truth）** で、クライアントはその写し（レプリカ）を持ちます。

同じコンポーネント関数を Node（サーバー）とブラウザ（クライアント）の両方で実行し、`xsync.server` / `xsync.client` で「どちらの環境で動くか」だけを書き分けます。ゲームロジックはサーバー側にだけ書き、クライアント側は描画と入力だけを書く、という形になります。

```js
import { xnew, xsync } from '@mulsense/xnew';

export function Player(unit) {
  const state = xsync.state({ x: 0, y: 0 });   // 共有される状態

  xsync.server(() => {                          // Node でのみ実行
    unit.on('update', () => { state.x += 1; });
  });

  xsync.client(() => {                          // ブラウザでのみ実行
    const el = xnew.nest('<div class="absolute w-4 h-4 bg-blue-500">');
    unit.on('update', () => { el.style.left = `${state.x}px`; });
  });
}
```

## 全体像

```
        server (Node)                                  client (browser)
  ┌───────────────────────────┐                  ┌───────────────────────────┐
  │ xsync.boot({ io, room })   │                  │ xsync.boot({ io, client,  │
  │   Game                     │                  │              room })       │
  │   └ World                  │ ── 'sync' ────▶  │   Game                     │
  │      ├ Player (state)      │   状態チャンネル  │   └ World                  │
  │      └ Player (state)      │   変化時のみ      │      ├ Player (replica)    │
  │                            │                  │      └ Player (replica)    │
  │  unit.on('-move')          │ ◀── 'emitToServer'│  xsync.emitToServer('-move')│
  └───────────────────────────┘   メッセージ      └───────────────────────────┘
```

- **状態（state）** は一方通行です。サーバー → クライアントにしか流れません。
- **クライアントからの働きかけ** はメッセージ（`xsync.emitToServer`）で行い、サーバーが state を書き換えます。
- **client → client の直接通信はありません。** 全員に配りたいものは、サーバーのハンドラから `xsync.emitToClients` で中継します。

### 3 つのチャンネル

`xsync` が socket 上で使うイベント名は次のとおりです（アプリのイベント名として使わないでください）。

| チャンネル | 方向 | wire イベント | 役割 |
| --- | --- | --- | --- |
| 状態 | server → client | `sync` | 同期ツリーのスナップショット。**変化したときだけ**送られます |
| 名簿 | server → client | `status` | ルームの参加者一覧 |
| メッセージ | client → server | `emitToServer` | サーバー側で任意のイベントを発火する |
| メッセージ | server → client | `emitToClients` | クライアント側で任意のイベントを発火する |
| ライフサイクル | 双方向 | `connect` / `disconnect` / `notfound` | `sync.connect` などとして各 unit に届く |

### サンプル

- `examples/1_xnew/sync/multiplay/` — ロビー / ルーム、シーン同期、チャット
- `examples/1_xnew/sync/hidden-info/` — `xsync.visibility` による秘密情報の分配

---

## 環境分岐 — `xsync.server` / `xsync.client`

同じコンポーネント関数がサーバーとクライアントの両方で実行されます。環境の判定は自動で、Node なら `server`、ブラウザ（`window.document` がある）なら `client` です。

```js
function Player(unit) {
  xsync.server(() => { /* Node でのみ実行される */ });
  xsync.client(() => { /* ブラウザでのみ実行される */ });
}
```

- `xnew.extend` と同じ扱いで、コールバックが返したオブジェクトは unit の defines になります。
- **初期化時のみ** 呼べます（コンポーネント関数の同期実行中）。
- 該当しない側では **コールバックが一切実行されません**。ブラウザ専用の API を触るコードは必ず `xsync.client` の中に置いてください。

:::warning ブラウザ専用ライブラリの import
サーバーとクライアントで共有する `game.js` から、addon（`xpixi` / `xthree` など）やブラウザ専用ライブラリを **静的 import しない** でください。`import` は `xsync.client` の判定より先に解決されるため、Node 側でも読み込まれて落ちます。ブラウザ側の entry（`index.js`）で `window` に載せてから参照するなど、動的に受け渡してください。
:::

---

## 起動 — `xsync.boot`

同期ツリーのルートを作ります。サーバーとクライアントで渡す引数が少し違います。

```js
// server
xsync.boot({ io, room }, Game);

// client
xsync.boot({ io, client, room }, Game);
```

| プロパティ | 型 | 説明 |
| --- | --- | --- |
| `io` | `any` | サーバーでは socket.io の `Server` インスタンス。クライアントでは socket を作る factory（`window.io`） |
| `room` | `{ id, name, count }` | 参加するルーム。`id` で socket.io の room を分けます |
| `client` | `{ name }` | クライアント側のみ。表示名。ハンドシェイクの query に載ります |

クライアント側の `boot` は **socket を自分で生成して所有します**。呼び出し側で socket を作る必要はありません（作ると二重接続になります）。`boot` が作った unit が finalize されると socket は自動的に切断されます。

```js
// boot が内部で行っていること（クライアント）
io({ query: { roomId: room.id, clientName: client?.name ?? '' }, forceNew: true });
```

`boot` が受け取るルートのコンポーネントは **1 つだけ** です（props は任意で続けられます）。ライフサイクルイベントのリスナーは **ルートの中** に置く必要があるので、ルートのコンポーネント関数の中でゲームを `xnew.extend` するのが定石です。

```js
xsync.boot({ io, client, room }, (u) => {
  xnew.extend(Game);
  u.on('sync.connect', ({ id }) => { /* ... */ });
  u.on('sync.notfound', () => unit.change(Lobby));
});
```

:::info ロビー / ルームは xsync に含まれません
`xsync` が提供するのは boot / state / emit などの同期ファサードだけです。「部屋一覧」「部屋の作成」といった集会所の配線は、アプリ側で socket.io を直接使って組みます（`examples/1_xnew/sync/multiplay/server.js` が実例です）。
:::

### `xsync.session`

現在の同期ルートのセッション情報を返します。ルートの配下でのみ使えます。

```js
xsync.session.room       // { id, name, count } 参加中のルーム
xsync.session.clients    // [{ id, name }, ...] ルームの参加者一覧
xsync.session.myself     // { id, name } 自分（client 側のみ）
```

- `clients` はサーバー / クライアントの両方で参照できます。サーバーは接続受理時に更新し、クライアントは `status` チャンネルで受け取ります。
- `myself` は **クライアント専用** です。サーバーで参照すると例外になります（サーバーには「自分」がいません）。
- 一覧が更新されると `sync.statusupdate` イベントが両側で発火します。

---

## 共有状態

### 同期ツリー

サーバーの `boot` ルート以下には、通常の unit ツリーが広がっています。そのうち **`xsync.register` で親に登録されたコンポーネントから作られた unit** だけが「同期ノード」として扱われ、クライアントに複製されます。

```
server                                 client
  Game        ← boot root                Game        ← boot root
   ├ (div)    ← 同期対象でない unit        （複製されない）
   └ World    ← register 済み  ────────▶   World      ← レプリカ
      └ Player ← register 済み ────────▶     └ Player  ← レプリカ
```

- 登録されていない unit は **素通り** します。その子が同期ノードなら、親 ID は「さらに上の同期ノード」になります。DOM を挟んでもツリー構造は保たれます。
- 同期ノードには 1 から始まる ID が割り当てられ、その unit が生きている限り変わりません。

### `xsync.register`

その unit の子として同期されうるコンポーネントを宣言します。**クライアントはこの表を使って、届いた名前からコンポーネントを引き当ててレプリカを作ります。** 登録されていない名前が届いた場合、そのノードは無視されます。

```js
export function World(unit) {
  xsync.register({ Player });   // World の子として Player が同期されうる

  xsync.server(() => {
    xnew(Player, { clientId, slot });   // サーバーで生成 → 全クライアントに複製される
  });
}
```

- 初期化時のみ呼べます（`invoked` フェーズ外で呼ぶと例外）。
- キーはワイヤ上の名前になります。サーバーとクライアントで **同じキー** に対応するコンポーネントを登録してください（通常は同じファイルを共有するので自動的に一致します）。

### `xsync.state`

その同期ノードが共有する状態を返します。**サーバーで書き、クライアントで読む** ためのオブジェクトです。

```js
export function Player(unit, { slot = '' } = {}) {
  const state = xsync.state({ x: 0, y: 0, slot });

  xsync.server(() => {
    unit.on('update', () => { state.x += 1; });   // 書くのはサーバー
  });

  xsync.client(() => {
    unit.on('update', () => { el.style.left = `${state.x}px`; });   // 読むのはクライアント
  });
}
```

- 返るのは同じ unit で共有される **同一のオブジェクト** です。何度呼んでも同じ参照が返ります。
- 引数の初期値は **まだ無いキーにだけ** 設定されます。クライアント側のレプリカは、生成時点でサーバーの値を持って構築されるので、`xsync.state({ x: 0 })` を書いてもサーバーの値が 0 に潰されることはありません。
- 値は JSON で送られます。関数・DOM 要素・クラスインスタンスなどは載せられません（数値・文字列・真偽値・配列・プレーンオブジェクトのみ）。
- クライアント側で書き換えても、次にサーバーから値が届いた時点で上書きされます。クライアントからの変更要求はイベントで送ってください。

### レプリカの生成と破棄

クライアントは届いたツリーを **差分適用（reconcile）** します。

| サーバー側 | クライアント側 |
| --- | --- |
| 同期ノードが生成された | `register` の表からコンポーネントを引き、レプリカ unit を生成 |
| state が変わった | 既存のレプリカの state を **その場で更新**（unit は作り直さない） |
| 同期ノードが finalize された | 対応するレプリカを finalize |
| ノードが不可視になった（後述の可視性） | 削除と同じ扱い（レプリカが finalize される） |

state の更新はオブジェクトを差し替えず、キー単位で書き換えます。そのため `xsync.state` で受け取った参照をクロージャに閉じ込めたままにできます。

:::info props はサーバー側だけのもの
`xnew(Player, { clientId, slot })` の props はサーバーで生成した unit にしか渡りません。レプリカは props なしで作られます。クライアントにも必要な値は **state に載せて** ください（上の例が `slot` を state に入れているのはこのためです）。
:::

---

## イベント

状態（`xsync.state`）はサーバー → クライアントの一方通行です。逆向きの働きかけや、状態にしたくない一過性の通知（チャット、効果音のトリガーなど）はイベントで送ります。

### 送信

メソッド名は **「どちら側で発火するか」** を表します。呼ぶ側ではありません。

| メソッド | 発火する場所 | 呼べる場所 |
| --- | --- | --- |
| `xsync.emitToServer(type, props)` | サーバー | 両方 |
| `xsync.emitToClients(type, props, ids?)` | クライアント | **サーバーのみ** |

```js
// client → server
xsync.emitToServer('-move', { vector: { x: 1, y: 0 } });

// server → 全クライアント（送信者含む）
xsync.emitToClients('chat', { id, text });

// server → 指定したクライアントだけ
xsync.emitToClients('deal', { card }, [clientId]);
```

- `emitToServer` をサーバーで呼ぶと、ワイヤを通らずローカルの `xnew.emit` と同じ動作になります。
- `emitToClients` をクライアントで呼ぶと例外です。クライアント発の全体配信は、サーバーのハンドラで受けてから中継します。

```js
// 定石: client の発言を server で受けて全員に配る
xsync.server(() => {
  unit.on('chat', ({ id, text }) => xsync.emitToClients('chat', { id, text }));
});
xsync.client(() => {
  sendButton.on('click', () => xsync.emitToServer('chat', { text: input.value }));
  unit.on('chat', ({ id, text }) => appendLine(id, text));
});
```

### 受信

いずれも通常の `unit.on` で受けます。

```js
unit.on('chat', ({ id, text }) => { /* ... */ });
```

第 1 引数には送信元の情報が混ざります。

| フィールド | 内容 |
| --- | --- |
| `id` | 送信元クライアントの socket id。**サーバー発の `emitToClients` では `undefined`** |
| その他 | `props` の中身がそのまま展開されます |

サーバーが中継するときに元の送信者を伝えたい場合は、`props` に明示的に載せてください（上の例の `{ id, text }` がそれです）。

### 宛先のスコープ — `-` プレフィックス

同じコンポーネントがルーム内に複数あるとき（プレイヤーごとの `Player` など）、宛先を絞る必要があります。

| 型名 | 届く範囲 |
| --- | --- |
| `'-move'` | **同じ同期ノード** のリスナーだけ（レプリカ ↔ サーバーの対応する 1 個） |
| `'chat'`（プレフィックスなし） | そのルート配下で、その型を listen している全 unit |

```js
// Player: 自機の入力を、サーバー側の「自分に対応する Player」にだけ届ける
xsync.client(() => {
  unit.on('window.keydown.wasd', ({ vector }) => xsync.emitToServer('-move', { vector }));
});
xsync.server(() => {
  unit.on('-move', ({ vector }) => { vel.x = Math.sign(vector.x); });   // 他人の move は届かない
});
```

`-` が使えるのは、送信側と受信側が同じ同期ノード（同じ ID）に属している場合です。レプリカは対応するサーバー側ノードの ID を持っているので、そのまま対応が取れます。

:::warning 予約語
`sync` / `status` / `emitToServer` / `emitToClients` はワイヤ上のイベント名として予約されています。アプリの `type` に使わないでください。
:::

### ライフサイクルイベント

boot ルートの配下に、次のイベントが自動的に発火します。**リスナーは boot ルートの中** に置いてください。

| イベント | 発火する側 | 内容 |
| --- | --- | --- |
| `sync.connect` | 両方 | `{ id }` の参加者が接続した |
| `sync.disconnect` | 両方 | `{ id }` の参加者が切断した |
| `sync.notfound` | client | 入室しようとしたルームが存在しなかった（自分の接続失敗のみ） |
| `sync.statusupdate` | 両方 | 参加者一覧（`xsync.session.clients`）が更新された |
| `sync.update` | **client のみ** | サーバーから届いた状態を適用し終えた |

自分と他人の区別は `id` の比較で行います。

```js
unit.on('sync.connect', ({ id }) => {
  if (id === xsync.session.myself.id) { /* 自分が入室した */ }
  else { /* 他の誰かが入室した */ }
});
```

自分ぶんのイベントは自分の socket から、他の参加者ぶんはサーバーの中継で届きます（送信者は除外されるので二重には発火しません）。

`sync.update` は「サーバーの状態が実際に変わって、それを適用し終えた」瞬間に **1 回だけ** 発火します。UI をまるごと作り直すような描画に使ってください。

```js
let dirty = true;
unit.on('sync.update', () => { dirty = true; });
unit.on('update', () => {
  if (dirty) { rebuild(); dirty = false; }   // 作り直しは tick の中で行う
});
```

毎フレーム位置を追従させるような描画（物理オブジェクトなど）は、`sync.update` を待たずに `on('update')` で state を読んでください。

### `xnew.scope` が必要な場面

socket のコールバックは xnew の tick の外で走ります。`xsync` が配るイベント（上記すべて）は内部で処理済みですが、**アプリが socket に直接ハンドラを付ける場合** や、addon のイベント（pixi の `pointerdown`、three のレイキャストなど）から `xsync.emitToServer` を呼ぶ場合は `xnew.scope` で包む必要があります。包まないと `Unit.current` がずれて `no socket bound to this root` になります。

```js
socket.on('roomcreated', xnew.scope((payload) => xnew.emit('-roomcreated', payload)));
```

---

## 可視性 — `xsync.visibility`

カードゲームの手札や、人狼の役職のように「特定のクライアントにだけ見せたい状態」があります。`xsync.visibility` は、その同期ノードを **どのクライアントに送るか** を宣言します。

```js
export function PlayerView(unit, { ownerId = '' } = {}) {
  const state = xsync.state({ ownerId, secret: 0, revealed: false });

  xsync.server(() => {
    state.secret = 1 + Math.floor(Math.random() * 100);
    xsync.visibility((clientId) => state.revealed || clientId === state.ownerId);
  });

  xsync.client(() => {
    xnew('<p>', `あなたの数字: ${state.secret}`);
  });
}
```

```js
xsync.visibility(predicate);   // (clientId: string) => boolean
xsync.visibility(null);        // 公開に戻す
```

- 既定では同期ノードは **公開** です。`visibility` を宣言しないノードは全員に届きます。
- 述語が `false` を返したクライアントには、そのノードが **存在しないものとして** 扱われます。届かないので、そのクライアントにはレプリカが作られません（すでにあれば finalize されます）。
- **子孫もまとめて除外されます。** 親が隠れているのに子だけ送ると、親 ID の解決先が無くなってしまうためです。
- 述語は **投影を作るたびに再評価されます**。フラグを閉じ込めておけば、それを立てるだけで動的に公開へ切り替わります（上の例の `revealed`）。

### サーバーで宣言する意味

`visibility` はサーバーが「ワイヤに載せるかどうか」を決めるものです。**除外されたクライアントには、その状態がそもそも送信されません。**

```
server ── captureStateTree('clientA') ──▶ clientA  … A の PlayerView だけ
       ── captureStateTree('clientB') ──▶ clientB  … B の PlayerView だけ
```

クライアント側で「見えないように描画しない」のは、DevTools で通信内容を覗けば見えてしまうため、秘密情報の保護になりません。必ず `xsync.server` ブロックの中で宣言してください。

典型的な形は、クライアント 1 人につき 1 つのノードを作り、その所有者だけに見えると宣言するものです（実例は `examples/1_xnew/sync/hidden-info/`）。

```js
xsync.server(() => {
  unit.on('sync.connect', ({ id }) => xnew(PlayerView, { key: id, ownerId: id }));
  unit.on('sync.disconnect', ({ id }) => xnew.find(PlayerView, { key: id })[0]?.finalize());
});
```

---

## 更新タイミングと通信量

「60Hz で動くなら、毎フレーム サーバーから状態が送られてくるのか？」への答えです。

**結論: tick は 60Hz ですが、状態の送信は変化したときだけです。**

### tick は 60Hz

xnew のエンジンは 60fps の ticker を 1 本持ち、そこから全 unit の `update` イベントが発火します。

- ブラウザ: `requestAnimationFrame`
- Node: `setTimeout`

どちらも「目標時刻を `+= 1000/60` で積む」絶対スケジュールなので、端数が累積せず平均 60Hz を保ちます。サーバー（Node）もクライアント（ブラウザ）も、この同じ仕組みで 60Hz です。

### 状態チャンネルは「変化したときだけ」

サーバーの boot ルートは毎 tick、次を行います。

```
毎 tick、接続クライアントごとに:
  1. 同期ツリーを走査して、そのクライアント向けの投影を作る（visibility を適用）
  2. JSON 文字列にする
  3. 前回そのクライアントに送った文字列と比較する
  4. 異なるときだけ 'sync' を emit する
```

つまり:

- **誰も動いていなければ、ワイヤには何も流れません。** 待機画面やターン待ちの間、通信量はゼロです。
- **1 つでも値が変われば、そのクライアント向けのツリー全体が送られます。** 差分（変わったフィールドだけ）は送りません。差分の適用はクライアント側で行われます。
- 逆に言うと、**`sync` が届いた ＝ 何かが変わった** ということです。クライアントはこれを受けて `sync.update` を発火します。

クライアント側にも同じ比較（前回適用したツリーとの一致判定）が入っているので、サーバーが同じ内容を再送しても `sync.update` が二重に走ることはありません。

### 何が「変化」とみなされるか

判定は **投影全体の JSON 文字列の完全一致** です。ノードの追加・削除・並び順、いずれかの state の 1 フィールドの変化、どれでも「変化」になります。

ここから実用上の注意が 2 つあります。

**1. 微小な変化でも毎フレーム送信になる**

物理演算などで座標がわずかに揺れ続けると、視覚的には止まって見えても JSON は毎フレーム変わり、60Hz で送り続けます。静止時に通信を止めたい場合は、state に載せる時点で丸めてください。

```js
unit.on('update', () => {
  state.x = Math.round(body.position.x * 10) / 10;   // 0.1 単位に丸める → 静止すれば送信も止まる
});
```

**2. 送る必要のない値を state に載せない**

state は同期ノード単位ではなくツリー単位で比較・送信されます。頻繁に変わる内部変数を state に置くと、そのルーム全体の送信頻度が上がります。サーバー内部でしか使わない値は普通のローカル変数にしてください。

### メッセージとライフサイクルは tick と無関係

`xsync.emitToServer` / `xsync.emitToClients` は **呼んだ瞬間に** 送られます。tick に合わせてまとめられることはありません。入力の遅延は tick の影響を受けないので、キー入力はそのまま即時にサーバーへ届きます。

`sync.connect` / `sync.disconnect` / `status`（参加者一覧）も同様に、socket のイベントとして即時に処理されます。

### 通信量の目安

1 ノードの JSON はおおよそ次の形です。

```json
{"id":3,"name":"Player","parent":2,"state":{"x":112,"y":64,"clientId":"aBc123","slot":"p1"}}
```

これで約 90 バイトです。2 人プレイで同期ノードが 4 つ（World + Player×2 + Board）なら、1 回の `sync` はおよそ 350〜400 バイト。両者が動き続けて毎 tick 変化する最悪ケースで、

```
400 バイト × 60Hz ≒ 24 KB/s（クライアント 1 人あたり）
```

程度です。動きが止まればゼロになります。あくまで概算なので、実際の値は DevTools の Network（WS フレーム）で確認してください。

### CPU コスト（クライアント数に対して線形）

送信は変化時だけですが、**投影の作成と JSON 化は毎 tick、クライアントの人数ぶん行われます**（`visibility` がクライアントごとに異なる結果を返しうるため）。

```
毎 tick のサーバー負荷 ≒ O(接続クライアント数 × 同期ノード数)
```

数人〜十数人のルームでは問題になりませんが、1 ルームの人数を大きくする設計では、同期ノード数と state のサイズを絞ることが効いてきます。

### クライアント側の描画タイミング

クライアントの `update` は rAF で駆動されるので、**状態の受信タイミングとは独立** です。

- 受信は socket のイベントとして随時、state に反映されます。
- 描画は 60Hz の `update` で、そのとき最新の state を読んで行われます。

補間や予測（クライアントサイド予測、ラグ補償）は組み込まれていません。クライアントは **受け取った最後の状態をそのまま描きます**。サーバーが 60Hz で動かしていれば通常は十分滑らかですが、回線状況によってはカクつきが見えます。必要なら、アプリ側で state の値を補間して描画してください。

:::info タブが非表示のとき
ブラウザの `requestAnimationFrame` は非表示タブで停止するため、クライアントの `update` は止まります。受信自体は続き、state は最新に保たれるので、タブに戻ると最新状態から再開します。サーバー（Node）の tick は影響を受けません。
:::
