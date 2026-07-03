# xnew.transition

`xnew.transition` は指定した時間にわたって値を `0` から `1` まで変化させ、フレームごとにコールバックを呼び出します。この値を不透明度・位置・スケール・色などに適用すれば、1 回の呼び出しで滑らかなアニメーションが得られます。

連鎖呼び出しに対応しており、timeout や transition をネストせずにシーケンスを構築できます。

## 使い方

```js
const timer = xnew.transition(callback, duration, easing);
```

**パラメータ:**
- `callback({ value })`: 進捗値 (0.0 〜 1.0) を引数にフレームごとに呼び出される関数
- `duration`: アニメーションの長さ (ミリ秒、既定値: 0)
- `easing`: イージング関数名 (既定値: `'linear'`)

**戻り値:**
- 次のメソッドを持つ timer オブジェクト:
  - `clear()`: キャンセル
  - `timeout(...)` / `interval(...)` / `transition(...)`: 次の処理を連鎖

## イージング関数

- `'linear'` — 一定速度
- `'ease'` — 開始と終了がゆっくり、中間が速い
- `'ease-in'` — 開始がゆっくり
- `'ease-out'` — 終了がゆっくり
- `'ease-in-out'` — 開始と終了がゆっくり

## 例

### フェードイン

```js
xnew('<div>', (unit) => {
  unit.element.textContent = 'Fading in...';
  unit.element.style.opacity = '0';

  xnew.transition(({ value }) => {
    unit.element.style.opacity = value;
  }, 2000, 'ease-in');
});
```
### transition のキャンセル

```js
xnew('<div>', (unit) => {
  unit.element.textContent = 'Click to stop animation';

  const transition = xnew.transition(({ value }) => {
    unit.element.style.opacity = 1 - value;
  }, 5000, 'linear');

  unit.on('click', () => {
    transition.clear();
    unit.element.textContent = 'Animation stopped';
  });
});
```

## 自動クリーンアップ

unit が finalize されると、その unit に紐づくすべての transition が自動でキャンセルされます。

```js
const unit = xnew((unit) => {
  xnew.transition(({ value }) => {
    console.log('Progress:', value);
  }, 5000, 'linear');
});

// Finalize after 2 seconds - transition automatically stops
xnew.timeout(() => {
  unit.finalize();
}, 2000);
```
