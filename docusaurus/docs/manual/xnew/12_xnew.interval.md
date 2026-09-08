# xnew.interval

`xnew.interval` は自動クリーンアップに対応した `setInterval` です。所属する unit が終了すると interval は自動停止します。ID を保持して `clearInterval` を呼ぶ必要はありません。

## 使い方

```js
const timer = xnew.interval(callback, duration, iterations);
```

**パラメータ:**
- `callback`: 各 interval で実行する関数。`{ count }` を受け取る（`count` は現在の実行回数。`0` から始まる）
- `duration`: 実行間隔 (ミリ秒)
- `iterations` *(省略可)*: 実行回数。`0`（既定）で無制限

**戻り値:**
- `clear()` メソッドを持つ timer オブジェクト

## 例

### カウンター

```js
xnew('<div>', (unit) => {
  let count = 0;
  unit.current.textContent = count;

  xnew.interval(() => {
    count++;
    unit.current.textContent = count;
  }, 1000); // Update every second
});
```

### interval のキャンセル

戻り値の timer で `clear()` を呼ぶと停止できます。コールバックは現在の実行回数 `count` を受け取ります。

```js
xnew('<div>', (unit) => {
  unit.current.textContent = 'Starting countdown...';

  const timer = xnew.interval(({ count }) => {
    unit.current.textContent = `Count: ${count + 1}`;

    // Stop after 10 iterations
    if (count + 1 >= 10) {
      timer.clear();
      unit.current.textContent = 'Countdown complete!';
    }
  }, 500);
});
```

## 自動クリーンアップ

unit が destroy されると、その unit に紐づくすべての interval が自動でキャンセルされます。

```js
const unit = xnew((unit) => {
  xnew.interval(() => {
    console.log('This will stop when unit is destroyed');
  }, 1000);
});

// Destroy after 5 seconds - interval automatically stops
xnew.timeout(() => {
  unit.destroy();
}, 5000);
```
