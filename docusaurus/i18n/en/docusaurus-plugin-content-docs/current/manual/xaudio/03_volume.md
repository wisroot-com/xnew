# xaudio.volume

`xaudio.volume` is the getter / setter for the master volume. Tracks from [`xaudio.load`](./load) and synthesizers from [`xaudio.synthesizer`](./synthesizer) all mix through the shared master bus, so this single value controls the volume of every source at once.

```js
import { xnew, xaudio } from '@mulsense/xnew';

function Main(unit) {
  const input = xnew('<input type="range" min="0" max="100">');
  input.current.value = xaudio.volume * 100;
  input.on('input', ({ event }) => xaudio.volume = event.target.value / 100);
}
```

- The value ranges from `0` (silent) to around `1`. Defaults to `0.1`.
- Per-track volume is adjusted through the track's own `volume` accessor (multiplied with the master).

:::note
The value is backed by a Web Audio `AudioParam` (float32), so setting `0.1` reads back as something like `0.10000000149…`. Round it for display, e.g. `Math.round(xaudio.volume * 100)`.

If you want a slider UI with a speaker icon, `xbasics.VolumeController` wraps this for you.
:::
