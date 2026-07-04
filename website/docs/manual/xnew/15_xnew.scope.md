# xnew.scope

`xnew.scope` は現在のコンポーネントコンテキストを取り込み、呼び出し時にそのコンテキストを復元するラッパー関数を返します。素の `setTimeout` やネイティブの `addEventListener` の中では xnew のスコープが失われるため、その内部で xnew API を呼び出したいときに使用するエスケープハッチです。

`xnew.timeout` / `xnew.interval` / `unit.on` はスコープを自動で保持するので、通常は出番がありません。

## 使い方

```js
xnew.scope(callback);
```

**パラメータ:**
- `callback` — スコープを保持して実行する関数

**戻り値:**
- スコープを保持したラップ関数

## 例

### setTimeout でのスコープ保持

```js
function Timer(unit) {
  xnew.nest('<div>');

  setTimeout(xnew.scope(() => {
    // The Timer component scope is preserved in this callback
    console.log('Timeout executed');
  }), 1000);
}
```

### イベントリスナーでの利用

```js
function Button(unit) {
  const el = xnew.nest('<button>');
  el.textContent = 'Click me';

  el.addEventListener('click', xnew.scope(() => {
    // The Button component scope is preserved on click
    console.log('Button clicked');
  }));
}
```

