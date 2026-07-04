# AudioTrack

`AudioTrack` は音声ファイルを取得・デコードして再生する組み込みコンポーネントです。`play` / `pause` で駆動し、パッケージ共有のオーディオバスへミックスされます。unit が破棄されると、確保していた Web Audio ノードは自動的に解放されます。

読み込みを意識する必要はありません。デコードが終わる前に `play()` を呼んでも、ロード完了まで再生を自動的に遅延します。

```js
import { xnew, xbasics } from '@mulsense/xnew';

function Main(unit) {
  const music = xnew(xbasics.AudioTrack, { url: 'bgm.mp3', loop: true });

  xnew('<button>', 'play').on('click', () => music.play({ fade: 1000 }));
  xnew('<button>', 'pause').on('click', () => music.pause({ fade: 1000 }));
}
```

## プロパティ（生成時）

`xnew(xbasics.AudioTrack, props)` に渡すオプションです。

| プロパティ | 型 | 説明 |
| --- | --- | --- |
| `url` | `string` | 読み込む音声ファイルの URL（必須）。 |
| `volume` | `number` | このトラックの音量。既定は `1.0`。 |
| `loop` | `boolean` | ループ再生するか。既定は `false`。 |

## メソッド

### `play({ offset, fade, loop })`

再生を開始します。引数はすべて省略可能です。

- `offset` — 再生開始位置（ミリ秒）。省略時は前回 `pause` した位置から再開します（初回は先頭から）。`play({ offset: 0 })` で先頭から再生し直せます。
- `fade` — フェードインの時間（ミリ秒）。既定は `0`。
- `loop` — このタイミングでループ設定を上書きします。

デコード完了前に呼び出した場合は、ロード完了まで自動的に遅延されます。

### `pause({ fade })`

再生を一時停止します。停止位置は保持され、次の `play()` はそこから再開します。

- `fade` — フェードアウトの時間（ミリ秒）。既定は `0`。

## アクセサ

- `isPlaying` — 再生中かどうか（`boolean`、読み取り専用）。
- `isLoaded` — デコードが完了しているか（`boolean`、読み取り専用）。
- `volume` — このトラックの音量（`number`、読み書き可能）。

:::note
全体のマスター音量を扱いたい場合は `xbasics.Volume` を使います。`xnew.extend(xbasics.Volume)` で取り込み、その `volume` プロパティを読み書きすると、すべての音源に共通する音量を制御できます。
:::

## デモ

<iframe style={{width:'100%',height:'400px',border:'solid 1px #DDD',borderRadius:'6px'}} src="/xnew/1_xnew/music/index.html" ></iframe>
