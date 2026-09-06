# xaudio.volume

`xaudio.volume` はマスター音量の getter / setter です。[`xaudio.load`](./load) のトラックと [`xaudio.synthesizer`](./synthesizer) のシンセサイザーはすべて共有のマスターバスへミックスされるため、この値ひとつで全音源の音量をまとめて制御できます。

```js
import { xnew, xaudio } from '@mulsense/xnew';

function Main(unit) {
  const input = xnew('<input type="range" min="0" max="100">');
  input.current.value = xaudio.volume * 100;
  input.on('input', ({ event }) => xaudio.volume = event.target.value / 100);
}
```

- 値の範囲は `0`（無音）〜 `1` 程度。既定は `0.1` です。
- 各トラック個別の音量は、トラック側の `volume` アクセサで調整します（マスターと乗算されます）。

:::note
値の実体は Web Audio の `AudioParam`（float32）なので、`0.1` を設定しても読み返すと `0.10000000149…` のような値になります。UI に表示するときは `Math.round(xaudio.volume * 100)` のように丸めてください。

スピーカーアイコン付きのスライダー UI が必要なら、これをラップした `xbasics.VolumeController` が使えます。
:::
