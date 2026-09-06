# xnew.find

`xnew.find` は、指定したコンポーネントから生成された、現在アクティブな unit すべてを返します。配列を自前で管理せずに、敵への一斉通知・カウンターの一括同期・衝突判定の対象列挙などを行えます。

## 使い方

```js
const units = xnew.find(Component);            // 該当する unit をすべて取得
const [unit] = xnew.find(Component, { key });  // 予約 prop `key` で 1 つに絞り込む
const inside = xnew.find(Component, { ancestor }); // 指定した unit を祖先に持つ（深さ問わず）unit に絞り込む
const children = xnew.find(Component, { parent });  // 指定した unit の直下の子に絞り込む
```

**パラメータ:**
- `Component`: 検索対象のコンポーネント関数
- `opts.key` *(省略可)*: 予約 prop `key`（生成時に `xnew(Component, { key })` で付与）が一致する unit に絞り込みます
- `opts.ancestor` *(省略可)*: 指定した unit を祖先に持つ unit に絞り込みます（何階層下でも可）。指定した unit 自身は含まれません
- `opts.parent` *(省略可)*: 親が指定した unit である unit（直下の子）に絞り込みます

各オプションは、見つかった unit に対する独立した条件です。同時に指定した場合は AND として働くので、組み合わせに禁止はありません。

**戻り値:**
- 条件に一致する、現在アクティブな unit の配列

## 例

### 基本

```js
function Counter(unit) {
  xnew.nest('<div>');
  let count = 0;
  unit.current.textContent = count;

  return {
    increment() {
      count++;
      unit.current.textContent = count;
    }
  };
}

// Create multiple counters
const counter1 = xnew(Counter);
const counter2 = xnew(Counter);
const counter3 = xnew(Counter);

// Find all Counter units
const allCounters = xnew.find(Counter);
console.log(allCounters.length); // 3

// Increment all counters at once
allCounters.forEach(counter => counter.increment());
```

### 複数インスタンスの管理

```js
function Player(unit, { name }) {
  xnew.nest('<div>');
  unit.current.textContent = `Player: ${name}`;

  let score = 0;

  return {
    addScore(points) {
      score += points;
      unit.current.textContent = `Player: ${name} - Score: ${score}`;
    },
    getScore() {
      return score;
    }
  };
}

// Create players
xnew(Player, { name: 'Alice' });
xnew(Player, { name: 'Bob' });
xnew(Player, { name: 'Charlie' });

// Find all players
const players = xnew.find(Player);

// Add points to all players
players.forEach(player => player.addScore(10));

// Calculate total score
const totalScore = players.reduce((sum, player) => sum + player.getScore(), 0);
console.log('Total score:', totalScore); // 30
```

## ユースケース

- **一括操作** — 同種のコンポーネントすべてを更新・制御する
- **状態の同期** — 複数のコンポーネントを同じ状態に保つ
- **ブロードキャスト** — 全インスタンスに同じメッセージを送る
- **一括クリーンアップ** — 全インスタンスをまとめて削除する
- **統計と監視** — アクティブなインスタンス数の集計や分析を行う

返されるのはアクティブな unit のみで、finalize 済みの unit は含まれません。
