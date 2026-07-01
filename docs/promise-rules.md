
# xnew.promise の集約ルール

## 基本

- `xnew.promise(promise|fn)` … promise を現在の unit に登録する。
- `xnew.promise(key, promise|fn)` … key 付きで登録する。
- `xnew.promise(unit)` … その unit に登録済みの promise 群を集約した UnitPromise を返す。
  `.then(results => ...)` で待つ。

集約結果は**常にオブジェクト**。

- **key 付き**は、その key のプロパティになる（`name[]` 形式なら `name` を配列にして登録順に push）。
- **key なし**は await される（完了待ちの対象にはなる）が、**結果オブジェクトには含まれない**。

```
全て key なし → {}
混在          → { key1, ... }        // key なしの値は出ない
全て key 付き → { key1, key2, ... }
```

集約は対象 unit のプールを**消費（リセット）しない**。同じ unit を何度でも集約でき、
常に同じ promise 群を見る。

`.then` の中で非同期継続をしたい場合は `return new Promise(...)` を使う（`.then` の中で
`xnew.promise(...)` を同期登録する使い方は想定しない）。


# case 1

```js
function Parent(unit) {
    // scope 1
    const child = xnew(Child);

    xnew.promise(child).then(({ key1, key2, key3 }) => { // E
        // scope 1
    });
}

function Child(unit) {
    // scope 2
    xnew.promise('key1', ...); // A
    xnew.promise('key2', ...); // B

    xnew.promise('key3', unit).then(({ key1, key2 }) => { // C
        // scope 2
        return data; // as key3
    });
}
```

- C: A,B が解決したらスタート。C は集約時点の `[A, B]` を集約するので `{ key1, key2 }` を受け取る。
- E: A,B,C（C が return した値）が解決したらスタート。プールは消費されないので、E は
  A,B,C 全てを集約し `{ key1, key2, key3 }` を受け取る。
- E の `xnew.promise` 内（`.then` の callback）は Parent のスコープ（scope 1）で実行される。


# case 2 — key なしの集約

```js
function Child(unit) {
    xnew.promise(...); // A （key なし）
    xnew.promise(...); // B （key なし）

    xnew.promise(unit).then((results) => { // C
        // results === {}   （A, B は await されるが結果には出ない）
        return data;
    });
}
```

key なしで登録した promise は「完了を待つ」ためだけに使う。結果を受け取りたい値には key を付ける。


# case 2 — key 付き集約のネスト

`xnew.promise('key', unit)` のように key 付きで他 unit を集約すると、その unit の集約結果が
key の値としてネストされる。プールは消費されない。

```js
function Parent(unit) {
    const child = xnew(Child);

    xnew.promise('child', child); // F  子の集約結果を 'child' キーで親に登録

    xnew.promise(unit).then(({ child }) => { // G
        // child === { key1, key2 }
    });
}

function Child(unit) {
    xnew.promise('key1', ...); // A
    xnew.promise('key2', ...); // B
}
```

- F: A,B を `{ key1, key2 }` に集約し、key `'child'` で Parent のプールに登録する。
- G: A,B が解決したらスタート。results は `{ child: { key1, key2 } }`。
- 孫→子→親と多段にネストできる（子側が全て key なしなら `{ child: {} }`）。
