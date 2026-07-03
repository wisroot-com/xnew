# xnew.interval

`xnew.interval` は自動クリーンアップに対応した `setInterval` です。所属する unit が終了すると interval は自動停止します。ID を保持して `clearInterval` を呼ぶ必要はありません。

## 使い方

```js
const timer = xnew.interval(callback, duration, iterations);
```

**パラメータ:**
- `callback`: 各 interval で実行する関数。`{ timer }` を受け取る（`timer` は自身の timer インスタンス。`timer.clear()` でコールバック内から停止できる）
- `duration`: 実行間隔 (ミリ秒)
- `iterations` *(省略可)*: 実行回数。`0`（既定）で無制限

**戻り値:**
- `clear()` メソッドを持つ timer オブジェクト

## 例

### カウンター

```js
xnew('<div>', (unit) => {
  let count = 0;
  unit.element.textContent = count;

  xnew.interval(() => {
    count++;
    unit.element.textContent = count;
  }, 1000); // Update every second
});
```

### interval のキャンセル

コールバックは自身の `timer` を受け取るので、外部の変数を介さずにその場で停止できます。

```js
xnew('<div>', (unit) => {
  unit.element.textContent = 'Starting countdown...';

  let count = 0;
  xnew.interval(({ timer }) => {
    count++;
    unit.element.textContent = `Count: ${count}`;

    // Stop after 10 iterations
    if (count >= 10) {
      timer.clear();
      unit.element.textContent = 'Countdown complete!';
    }
  }, 500);
});
```

## 自動クリーンアップ

unit が finalize されると、その unit に紐づくすべての interval が自動でキャンセルされます。

```js
const unit = xnew((unit) => {
  xnew.interval(() => {
    console.log('This will stop when unit is finalized');
  }, 1000);
});

// Finalize after 5 seconds - interval automatically stops
xnew.timeout(() => {
  unit.finalize();
}, 5000);
```
