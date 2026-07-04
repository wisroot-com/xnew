# xnew

`xnew` はライブラリの中核となる関数で、コンポーネントの実体である **unit** を生成します。unit が破棄されると、内部のタイマー・リスナー・子要素はまとめて自動で解放されるため、後片付けのコードは不要です。

## 使い方

```js
const unit = xnew(target, Component, props); // target は省略可
```

- `target` *(省略可)* — アタッチ先の要素。DOM 要素、または `'<div class="box">'` のような HTML 文字列を指定します。省略すると親の要素を継承します。
- `Component` *(省略可)* — この unit の振る舞いを定義する関数です。
- `props` *(省略可)* — コンポーネント関数の第 2 引数として渡されるデータです。

## コンポーネント

コンポーネントは関数です。所属する unit と、生成時に渡された props を受け取ります。継承や拡張のための特別な記法はありません。

```js
function MyComponent(unit, { message }) {
  unit.element.textContent = message; // unit.element でアタッチ先の DOM 要素にアクセス
}

const unit = xnew(MyComponent, { message: 'Hello World' });
```

アロー関数でもそのまま書けます。

```js
xnew((unit) => {
  unit.element.style.color = 'blue';
});
```

## ターゲット指定

`target` はコンポーネントのアタッチ先を決めます。コンポーネント内ではいつでも `unit.element` から参照できます。

```js
// 1. 既存の DOM 要素にアタッチ
xnew(document.querySelector('#app'), (unit) => { /* unit.element === #app */ });

// 2. HTML 文字列から新しい要素を生成してアタッチ
xnew('<div class="box">', (unit) => { /* unit.element === 生成された div */ });

// 3. target 省略で親の要素を継承
xnew((unit) => { /* unit.element === 親の要素 */ });
```

`Component` の代わりに文字列や数値を渡すと、その内容を `textContent` に持つ要素を生成します。

```js
xnew('<p>', 'This is a paragraph'); // <p>This is a paragraph</p>
```

## イベント

DOM イベント・ライフサイクルイベント・カスタムイベントは、すべて `unit.on` / `unit.off` で扱います。コールバックは第 1 引数にイベント情報のオブジェクトを受け取ります。

```js
const unit = xnew(MyComponent);

unit.on('click', ({ event }) => console.log('clicked'));

unit.off('click');        // 'click' のリスナーをすべて解除
unit.off();               // すべてのリスナーを解除
```

## ライフサイクルイベント

ライフサイクル全体は 2 つのイベントでカバーされます。必要なものだけ購読してください。

| イベント     | タイミング                    |
| ------------ | ----------------------------- |
| `update`     | 毎フレーム（おおよそ 60fps）  |
| `finalize`   | unit が破棄されるとき         |

```js
function AnimatedBox(unit) {
  let angle = 0;
  unit.on('update', () => {
    angle++;
    unit.element.style.transform = `rotate(${angle}deg)`;
  });
  unit.on('finalize', () => console.log('cleaned up'));
}
```

### ライフサイクル制御メソッド

unit は生成と同時に自動で開始され、`update` ループが回り始めます。破棄するときは `finalize` を使います。

- `unit.finalize()` — unit を破棄し、生成した要素を DOM から削除します。

```js
const unit = xnew('<div>', 'Click to destroy');
unit.on('click', () => unit.finalize());
```

### 実行順序

`update` などのイベントは、子が親より**先に**発火します（後片付けの `finalize` は逆に子が先）。

```js
function Parent(unit) {
  xnew(Child);
  unit.on('update', () => console.log('Parent update'));
}
function Child(unit) {
  unit.on('update', () => console.log('Child update'));
}
xnew(Parent);

// 出力（毎フレーム）:
// Child update
// Parent update
```

## DOM イベントのペイロード

標準の DOM イベント名はそのまま `unit.on` に渡せます。一部のイベントは `event` に加えて扱いやすい値を受け取れます。

| イベント                              | ペイロード                          |
| ------------------------------------- | ----------------------------------- |
| `click` / `pointerdown` など          | `{ event, position }` — 要素内座標   |
| `change` / `input`                    | `{ event, value }` — 入力値          |
| `wheel`                               | `{ event, delta }`                  |
| `dragstart` / `dragmove` / `dragend`  | `{ event, position, delta }`        |
| `window.keydown.arrow` / `.wasd`      | `{ event, vector }` — 方向ベクトル   |

```js
unit.on('pointerdown', ({ position }) => console.log(position.x, position.y));
unit.on('input', ({ value }) => console.log(value));
```

- `window.` / `document.` を前置すると、リスナーを `window` / `document` にバインドできます（例: `'window.keydown'`）。
- `.outside` を付けると要素の外で発火します（例: `'pointerdown.outside'`）。

## カスタムイベント

イベント名のプレフィックスで通信範囲を切り替え、コンポーネント間を疎結合に保ったまま通信できます。`xnew.emit` で送信し、`unit.on` で受信します。

- `+` プレフィックス — **グローバル**。起動中のすべての unit が受信します（スコア更新やゲームオーバー通知など）。
- `-` プレフィックス — **内部**。送信元の unit 自身のリスナーだけが受信します（子から親への通知など）。

```js
function Sender(unit) {
  unit.on('click', () => xnew.emit('+message', { text: 'Hello!' }));
}
function Receiver(unit) {
  unit.on('+message', ({ text }) => console.log(text));
}

xnew(Sender);
xnew(Receiver); // 親子関係がなくても受信できる
```

## カスタムメソッド

コンポーネント関数からオブジェクトを返すと、その**関数プロパティ**（メソッド・getter・setter）が unit に組み込まれます。内部状態をカプセル化しつつ、必要な操作だけを外部に公開できます。

```js
function Counter(unit) {
  let count = 0;
  return {
    increment() { count++; },
    get value() { return count; },
  };
}

const counter = xnew(Counter);
counter.increment();
console.log(counter.value); // 1
```

### 予約済みのプロパティ名

次の名前は unit が既に使っているため、カスタムプロパティには使えません。

- `finalize`
- `element`, `parent`, `promise`, `on`, `off`
- `_`（内部用）

次は [`xnew.nest`](./xnew.nest) で、ネスト構造を簡潔に組み立てる方法を確認してください。
