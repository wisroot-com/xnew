# xaudio.load

`xaudio.load` creates a track that fetches and decodes an audio file and plays it back. It is driven by `play` / `pause` and mixes through the package's shared audio bus. The track's release is tied to a unit created under the current scope, so when the calling unit (e.g. a scene) is destroyed, the Web Audio nodes it holds are released automatically.

You don't have to worry about loading: calling `play()` before decoding finishes simply defers playback until the buffer is ready.

```js
import { xnew, xaudio } from '@mulsense/xnew';

function Main(unit) {
  const music = xaudio.load({ url: 'bgm.mp3', loop: true });

  xnew('<button>', 'play').on('click', () => music.play({ fade: 1000 }));
  xnew('<button>', 'pause').on('click', () => music.pause({ fade: 1000 }));
}
```

## Props (on creation)

Options passed to `xaudio.load(props)`.

| Prop | Type | Description |
| --- | --- | --- |
| `url` | `string` | URL of the audio file to load (required). |
| `volume` | `number` | Volume of this track. Defaults to `1.0`. |
| `loop` | `boolean` | Whether to loop. Defaults to `false`. |

## Methods

### `play({ offset, fade, loop })`

Starts playback. All arguments are optional.

- `offset` — Start position in milliseconds. If omitted, resumes from the last `pause` position (from the beginning on the first call). Use `play({ offset: 0 })` to restart from the start.
- `fade` — Fade-in duration in milliseconds. Defaults to `0`.
- `loop` — Overrides the loop setting at this call.

Called before decoding finishes, it defers until the load resolves.

### `pause({ fade })`

Pauses playback. The position is kept, and the next `play()` resumes from there.

- `fade` — Fade-out duration in milliseconds. Defaults to `0`.

## Accessors

- `status` — Current state (`'loading' | 'loaded' | 'playing' | 'paused'`, read-only). `'loading'` until decoding finishes, `'playing'` while playing, `'paused'` while paused by `pause()`, and `'loaded'` otherwise (before the first play, or after playback ends).
- `volume` — Volume of this track (`number`, read/write).

:::note
To control the overall master volume, read/write [`xaudio.volume`](./volume) — the volume shared by every source.
:::

## Demo

<iframe style={{width:'100%',height:'400px',border:'solid 1px #DDD',borderRadius:'6px'}} src="/xnew/1_xnew/audio/audiotrack/index.html" ></iframe>
