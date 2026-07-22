# mascot.gif — how it was generated

Recipe used to produce `docusaurus/static/img/mascot.gif` from this sample
(last run: 2026-07-07).

## Conditions

| item | value |
| --- | --- |
| page | this folder's `index.html`, served from the `examples/` root |
| viewport | 900 x 460 |
| frame stepping | Playwright virtual clock (`page.clock`) — deterministic, no dropped frames |
| playback fps | 20 |
| speed | half speed — virtual time advances 25ms per playback frame (`1000 / FPS / SLOW`, `SLOW = 2`) |
| length | 240 frames = 12s playback (6s of virtual time), seamless-ish loop |
| crop | top 20% and bottom 5% cut |
| scale | 720px wide (lanczos) |
| palette | ffmpeg `palettegen` / `paletteuse` |
| result | 720 x 276, ~3.6MB |

## Steps

1. Serve `examples/` with any static server (so `../../../dist/xnew.mjs` resolves).
2. Capture frames with Playwright (chromium headless shell):

```js
await page.clock.install();               // BEFORE goto — fakes rAF / timers
await page.goto('http://localhost:PORT/1_xnew/showcase/mascot/index.html', { waitUntil: 'networkidle' });
await page.clock.runFor(100);             // let deferred init (setTimeout-0 bindings) run

const FPS = 20, SLOW = 2, SECONDS = 12;   // SECONDS = playback length
for (let i = 0; i < FPS * SECONDS; i++) {
  await page.clock.runFor(1000 / FPS / SLOW);
  await page.screenshot({ path: `frames/f${String(i).padStart(3, '0')}.png` });
}
```

3. Encode with ffmpeg:

```sh
ffmpeg -y -framerate 20 -i frames/f%03d.png \
  -vf "crop=iw:ih*0.75:0:ih*0.20,scale=720:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" \
  mascot.gif
```

4. Copy to `docusaurus/static/img/mascot.gif`.

Notes

- The virtual clock makes the capture deterministic apart from `Math.random()`
  (jump timing), so each run loops differently — re-run until the takes look good.
- To lighten the file: lower `-framerate` + capture fps together, shrink `scale`,
  or shorten `SECONDS`.
