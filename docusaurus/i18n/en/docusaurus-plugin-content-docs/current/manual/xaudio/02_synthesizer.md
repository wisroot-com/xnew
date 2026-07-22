# xaudio.synthesizer

`xaudio.synthesizer` creates a synth combining an oscillator with amp / filter / reverb, ADSR envelopes, and an LFO. Trigger it with `press` to use it for sound effects or as a simple instrument. The synthesizer's release is tied to a unit created under the current scope, so it is released together with the calling unit.

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

## Options (on creation)

Settings passed to `xaudio.synthesizer(options)`.

| Option | Type | Description |
| --- | --- | --- |
| `oscillator` | object | Sound source. `type` (`sine` / `triangle` / `square` / `sawtooth`), plus an optional `envelope` (pitch modulation) and `LFO`. |
| `amp` | object | Amplitude envelope. `envelope` is required. |
| `filter` | object | Optional. `type` (`lowpass` / `highpass` / `bandpass`) and `cutoff` (4–8192). |
| `reverb` | object | Optional. `time` (0–2000ms) and `mix` (0–1). |
| `bpm` | `number` | Tempo used when durations are given as note lengths (60–240). Defaults to `120`. |

### Envelope (ADSR)

`oscillator.envelope` and `amp.envelope` take the shape `{ amount, ADSR }`.

- `amount` — Modulation amount. For amp it is level (0–1); for oscillator it is pitch in semitones (-36 to +36).
- `ADSR` — `[Attack, Decay, Sustain, Release]`. A / D / R are in milliseconds (0–8000), S is a 0–1 ratio.

### LFO

`oscillator.LFO` is `{ amount, type, rate }`, modulating pitch periodically (`amount`: 0–36 semitones, `rate`: 1–128Hz).

## Methods

### `press(frequency, duration?, wait?)`

Plays a note.

- `frequency` — Frequency in Hz, or a note name (e.g. `'A4'`).
- `duration` — Note length. Milliseconds (number) or a note value (`'4n'`, `'8n'`, ...). **With a duration the note auto-releases; without one it sustains and returns `{ release }`**, so you call `release()` yourself to stop it.
- `wait` — Delay before the attack, in milliseconds. Useful for staggering notes into an arpeggio.

```js
// Auto-stops (plays for a quarter note)
synth.press('C4', '4n');

// Manual stop (sounds while held)
const note = synth.press('C4');
// ... on release
note.release();

// Stagger into an arpeggio with wait
['C5', 'E5', 'G5', 'C6'].forEach((note, i) => synth.press(note, 120, i * 70));
```

:::note
The overall master volume is controlled with [`xaudio.volume`](./volume).
:::

## Demo

A demo where you can tweak the synth parameters.

<iframe style={{width:'100%',height:'640px',border:'solid 1px #DDD',borderRadius:'6px'}} src="/xnew/1_xnew/audio/synthesizer/index.html" ></iframe>

Combining `press` calls lets you build game-style sound effects.

<iframe style={{width:'100%',height:'260px',border:'solid 1px #DDD',borderRadius:'6px'}} src="/xnew/1_xnew/audio/soundeffect/index.html" ></iframe>
