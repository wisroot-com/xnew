# xnew.context

`xnew.context` を使うと、子孫コンポーネントから祖先の共有データを取得できます。

## 使い方

```js
const value = xnew.context(component);
```

**パラメータ:**
- `component`: コンテキストを表すコンポーネント関数

**戻り値:**
- コンテキスト値。見つからない場合は `undefined`

## 動作

検索は値が見つかるまで unit 階層を上方向に辿ります。

## 例

### データの共有

```js
xnew((unit) => {
  xnew(Data, { value: 1 });
  xnew(Child);
});

function Data(unit, { value }) {
  return {
    get value() { return value; }
  }
}

function Child(unit) {
  const data = xnew.context(Data);
  
  // data.value
}

```

### ネストしたコンテキストの上書き

```js
xnew((unit) => {
  xnew(Data, { value: 1 });
  xnew(Child1);
});

function Data(unit, { value }) {
  return {
    get value() { return value; }
  }
}

function Child1(unit) {
  const data = xnew.context(Data);
  // data.value == 1
  
  xnew(Data, { value: 2 });
  xnew(Child2);
}

function Child2(unit) {
  const data = xnew.context(Data);
  
  // data.value == 2
}
```

## ユースケース

- **テーマ / 設定** — ルートに `Theme` を 1 つ置き、配下のどこからでも参照する
- **ゲーム状態** — スコア・レベル・プレイヤーデータをシーンツリー全体で共有する
- **シーン管理** — `Flow` コントローラを props を経由せずに子シーンに渡す
- **依存性注入** — オーディオや入力など、多くのコンポーネントが必要とするサービスを提供する
