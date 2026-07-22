# xaudio.synthesizer

`xaudio.synthesizer` はオシレーターにアンプ / フィルター / リバーブ、ADSR エンベロープ、LFO を組み合わせたシンセサイザーを作成します。`press` で音を鳴らし、効果音や簡単な楽器として使えます。内部ではシンセサイザーが unit として現在のスコープに作られ、呼び出し元の unit の破棄とともに解放されます。

```js
import { xnew, xaudio } from '@mulsense/xnew';

function Main(unit) {
  const synth = xaudio.synthesizer({
    oscillator: { type: 'square' },
    amp: { envelope: { amount: 0.3, ADSR: [1, 80, 0.7, 120] } },
  });

  xnew('<button>', 'play').on('click', () => synth.press('A4', '4n'));
}
```

## オプション（生成時）

`xaudio.synthesizer(options)` に渡す設定です。

| オプション | 型 | 説明 |
| --- | --- | --- |
| `oscillator` | object | 音源。`type`（`sine` / `triangle` / `square` / `sawtooth`）に加えて、任意で `envelope`（ピッチ変調）と `LFO` を持ちます。 |
| `amp` | object | 音量エンベロープ。`envelope` は必須です。 |
| `filter` | object | 任意。`type`（`lowpass` / `highpass` / `bandpass`）と `cutoff`（4〜8192）。 |
| `reverb` | object | 任意。`time`（0〜2000ms）と `mix`（0〜1）。 |
| `bpm` | `number` | 音長を音符で指定するときのテンポ（60〜240）。既定は `120`。 |

### エンベロープ（ADSR）

`oscillator.envelope` と `amp.envelope` は `{ amount, ADSR }` の形をとります。

- `amount` — 変化量。amp では音量（0〜1）、oscillator では半音単位のピッチ（-36〜+36）。
- `ADSR` — `[Attack, Decay, Sustain, Release]`。A / D / R はミリ秒（0〜8000）、S は 0〜1 の比率。

### LFO

`oscillator.LFO` は `{ amount, type, rate }` でピッチを周期的に揺らします（`amount`: 0〜36 半音、`rate`: 1〜128Hz）。

## メソッド

### `press(frequency, duration?, wait?)`

音を鳴らします。

- `frequency` — 周波数（Hz）または音名（`'A4'` など）。
- `duration` — 音の長さ。ミリ秒（数値）または音符（`'4n'`, `'8n'` など）。**指定すると自動で発音を終える**。**省略すると音が持続し、`{ release }` を返す**ので、任意のタイミングで `release()` を呼んで止めます。
- `wait` — 発音を遅らせる時間（ミリ秒）。複数の音をずらして鳴らすアルペジオなどに使います。

```js
// 自動で止まる（4分音符ぶん鳴らす）
synth.press('C4', '4n');

// 手動で止める（押している間だけ鳴らす）
const note = synth.press('C4');
// ... 離すとき
note.release();

// wait でずらしてアルペジオ
['C5', 'E5', 'G5', 'C6'].forEach((note, i) => synth.press(note, 120, i * 70));
```

:::note
全体のマスター音量は [`xaudio.volume`](./volume) で制御できます。
:::

## デモ

シンセサイザーのパラメーターを操作できるデモです。

<iframe style={{width:'100%',height:'640px',border:'solid 1px #DDD',borderRadius:'6px'}} src="/xnew/1_xnew/basics/synthesizer/index.html" ></iframe>

`press` を組み合わせるとゲーム風の効果音も作れます。

<iframe style={{width:'100%',height:'260px',border:'solid 1px #DDD',borderRadius:'6px'}} src="/xnew/1_xnew/basics/soundeffect/index.html" ></iframe>
