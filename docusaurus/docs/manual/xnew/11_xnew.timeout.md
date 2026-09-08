# xnew.timeout

`xnew.timeout` は xnew 用に拡張された `setTimeout` です。所属する unit が終了すると自動でキャンセルされ、ID を保持して `clearTimeout` を呼ぶ必要はありません。

## 使い方

```js
const timer = xnew.timeout(callback, duration);
```

**パラメータ:**
- `callback`: 遅延後に実行する関数
- `duration`: 実行までの待機時間 (ミリ秒)

**戻り値:**
- 次のメソッドを持つ timer オブジェクト:
  - `clear()`: キャンセル
  - `timeout(...)` / `interval(...)` / `transition(...)`: 次の処理を連鎖

## 例

### 遅延実行

```js
xnew('<div>', (unit) => {
  unit.current.textContent = 'Click me!';

  unit.on('click', () => {
    unit.current.textContent = 'Clicked! Resetting in 2 seconds...';

    xnew.timeout(() => {
      unit.current.textContent = 'Click me!';
    }, 2000);
  });
});
```

### timeout のキャンセル

```js
xnew('<button>', (unit) => {
  unit.current.textContent = 'Start countdown';

  let timeout;

  unit.on('click', () => {
    // Cancel previous timeout if exists
    if (timeout) {
      timeout.clear();
    }

    unit.current.textContent = 'Countdown started...';

    timeout = xnew.timeout(() => {
      unit.current.textContent = 'Done!';
    }, 3000);
  });
});
```

## 自動クリーンアップ

unit が destroy されると、その unit に紐づくすべての timeout が自動でキャンセルされます。

```js
const unit = xnew((unit) => {
  xnew.timeout(() => {
    console.log('This will never execute');
  }, 5000);

  // Destroy after 1 second
  xnew.timeout(() => {
    unit.destroy(); // Automatically clears the 5-second timeout
  }, 1000);
});
```
