# AudioTrack

`AudioTrack` is a built-in component that fetches and decodes an audio file and plays it back. It is driven by `play` / `pause` and mixes through the package's shared audio bus. When the unit is finalized, the Web Audio nodes it holds are released automatically.

You don't have to worry about loading: calling `play()` before decoding finishes simply defers playback until the buffer is ready.

```js
import { xnew, xbasics } from '@mulsense/xnew';

function Main(unit) {
  const music = xnew(xbasics.AudioTrack, { url: 'bgm.mp3', loop: true });

  xnew('<button>', 'play').on('click', () => music.play({ fade: 1000 }));
  xnew('<button>', 'pause').on('click', () => music.pause({ fade: 1000 }));
}
```

## Props (on creation)

Options passed to `xnew(xbasics.AudioTrack, props)`.

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

- `isPlaying` — Whether it is currently playing (`boolean`, read-only).
- `isLoaded` — Whether decoding has finished (`boolean`, read-only).
- `volume` — Volume of this track (`number`, read/write).

:::note
To control the overall master volume, use `xbasics.Volume`. Pull it in with `xnew.extend(xbasics.Volume)` and read/write its `volume` property to control the volume shared by every source.
:::

## Demo

<iframe style={{width:'100%',height:'400px',border:'solid 1px #DDD',borderRadius:'6px'}} src="/xnew/1_xnew/music/index.html" ></iframe>
