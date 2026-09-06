# xnew.promise

`xnew.promise` は Promise をコンポーネントに紐付け、`.then()` / `.catch()` / `.finally()` のハンドラを現在のコンポーネントスコープで実行します。Promise の解決前にコンポーネントが破棄された場合、保留中のハンドラも破棄されるため、破棄済み DOM への書き込みなどの不具合が起きません。

## 使い方

```js
xnew.promise(source);        // Promise / 関数 / unit を登録・集約
xnew.promise(key, source);   // キー付きで登録
xnew.promise();              // deferred（{ resolve, reject } を返す）
```

**パラメータ:**
- `key`（省略可）: 集約結果でこの Promise の値が入るプロパティ名
- `source`: 標準の Promise、`(resolve, reject) => { ... }` 形式の関数、または unit（その unit に登録された promise を集約）

**戻り値:**
- 現在の xnew スコープでハンドラを実行するラップ済み Promise（`.then` / `.catch` / `.finally` をチェーンできる）
- 引数なし（またはキーのみ）で呼んだ場合は deferred の `{ resolve, reject }`

## 例

### Promise のラップ

```js
xnew((unit) => {
  xnew.promise(fetch('/api/data'))
    .then((res) => unit.current.textContent = 'loaded')
    .catch((err) => unit.current.textContent = 'error');
});
```

### deferred（手動で解決）

引数なしで呼ぶと `{ resolve, reject }` を返し、任意のタイミングで解決できます。

```js
function Loader(unit) {
  const deferred = xnew.promise();

  unit.on('click', () => deferred.resolve('done'));
}
```

### unit への集約

unit を渡すと、その unit に登録された promise をまとめて待てます。

```js
function Assets(unit) {
  xnew.promise('image', loadImage());
  xnew.promise('sound', loadSound());
}

const assets = xnew(Assets);
xnew.promise(assets).then((results) => {
  // results === { image: <画像>, sound: <音> }
  console.log('all assets ready', results);
});
```

集約結果は**常にオブジェクト**です。

- **キー付き**で登録した promise は、そのキーのプロパティになります。
- **キー無し**で登録した promise は、完了は待たれますが結果には含まれません。
- `xnew.promise('name[]', ...)` のように `[]` を付けると、同名のキーを登録順の配列にまとめます。

集約しても対象 unit のプールは消費されないため、同じ unit を何度でも集約でき、常に同じ結果になります。
