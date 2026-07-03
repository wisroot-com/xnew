# xnew.extend

`xnew.extend` は別のコンポーネントの振る舞いを現在の unit にミックスインします。新しい要素は生成しません。ドラッグ・ロギング・キーボード操作などの機能をコンポーネントとして用意しておけば、他のコンポーネントに 1 行で組み込めます。

## 使い方

```js
xnew.extend(Component, props);
```

**パラメータ:**
- `Component`: 拡張に使うコンポーネント関数
- `props`: コンポーネント関数に渡す任意のプロパティ

**動作:**
- コンポーネント関数を現在の unit のコンテキストで即時実行します。
- 戻り値のプロパティ・メソッドを現在の unit にマージします。
- イベントハンドラは累積され、後の拡張で上書きされません。
- 同じプロパティ名を返した場合は、後に実行された拡張が優先されます。

## 例

### ロガーのミックスイン

```js
function Logger(unit) {
  return {
    log(message) {
      console.log(`[${new Date().toISOString()}]`, message);
    }
  };
}

const unit = xnew((unit) => {
  xnew.extend(Logger);

  unit.log('Application started'); // immediately available
});

// Output: [2025-01-15T10:30:00.000Z] Application started
```

### ドラッグ可能化のミックスイン

ドラッグの処理を独立したコンポーネントに切り出し、他のコンポーネントから再利用する例です。

```js
function Draggable(unit) {
  let dragging = false;
  let startX, startY, originX, originY;

  unit.on('mousedown', ({ event }) => {
    dragging = true;
    startX = event.clientX;
    startY = event.clientY;
    originX = parseInt(unit.element.style.left) || 0;
    originY = parseInt(unit.element.style.top)  || 0;
  });

  unit.on('window.mousemove', ({ event }) => {
    if (!dragging) return;
    unit.element.style.left = originX + (event.clientX - startX) + 'px';
    unit.element.style.top  = originY + (event.clientY - startY) + 'px';
  });

  unit.on('window.mouseup', () => { dragging = false; });

  return { get isDragging() { return dragging; } };
}

// Any component can become draggable with one line:
function Card(unit) {
  xnew.extend(Draggable);
  xnew.nest('<div class="card" style="position:absolute;">');
  xnew('<p>', 'Drag me!');
}

xnew(Card);
```

:::note
`xnew.extend` はコンポーネントの初期化中 (コンポーネント関数の内部) でのみ呼び出せます。unit の生成後には呼び出せません。
:::

