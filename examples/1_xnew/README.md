# 1_xnew — features of `@mulsense/xnew`

Samples for everything importable from the `@mulsense/xnew` package itself
(no addons). Grouped by the package's three exports plus applied showcases.

Serve the `examples/` parent directory with any static server and open each
`index.html` (only `sync/multiplay` needs its own Node server — see below).

## core/ — export `xnew`

Recommended reading order.

| sample | shows |
| --- | --- |
| [element](core/element/) | creating / nesting DOM elements, DOM events (`click`, `input`, `change`) |
| [css](core/css/) | `xnew.css` pseudo-scoped CSS — local class names, `&:hover`, collision-free reuse, custom-property theming |
| [timer](core/timer/) | `xnew.interval` / `transition` / `timeout` chaining, `update` loop |
| [contextfind](core/contextfind/) | `xnew.context` (reach an ancestor's defines), `xnew.find` (+ `key`) |
| [customevent](core/customevent/) | `+event` broadcast, `-event` local, `xnew.protect` boundary |
| [windowevent](core/windowevent/) | `window.` prefix events, `.arrow` / `.wasd` key vectors |
| [pointer](core/pointer/) | `pointer*` / `drag*` events with positions and deltas |
| [promise](core/promise/) | `xnew.promise` registration and aggregated results |

## basics/ — export `xbasics`

| sample | shows |
| --- | --- |
| [screen](basics/screen/) | `Screen` (fixed-resolution canvas, `fit`), `Aspect` |
| [scene](basics/scene/) | `Scene` navigation — `change` (swap sibling scenes) / `add` (overlay) |
| [panel](basics/panel/) | `Panel` — groups, buttons, range / checkbox / select |
| [openandclose](basics/openandclose/) | `OpenAndClose` + `Accordion` / `Popup` (accordion, modal, menu) |
| [controller](basics/controller/) | `DPad` / `AnalogStick` virtual game pad |
| [svg](basics/svg/) | `SVG` icon base, `SVGText` outlined labels |
| [audiotrack](basics/audiotrack/) | `AudioTrack` music playback, `Volume` master gain |
| [synthesizer](basics/synthesizer/) | `Synthesizer` interactive keyboard playground |
| [soundeffect](basics/soundeffect/) | `Synthesizer` recipes for game sound effects |

## sync/ — export `xsync`

| sample | shows |
| --- | --- |
| [multiplay](sync/multiplay/) | lobby / room / synced game over socket.io — run `npm install && npm start` inside the folder |

## showcase/ — applied samples

| sample | shows |
| --- | --- |
| [typewriter](showcase/typewriter/) | dialog box with a typewriter text stream |
| [screenshot](showcase/screenshot/) | capturing the screen to a PNG (html2canvas) |

## manual/

Minimal snippets embedded in the website documentation (`website/docs/manual/getstarted.md`).
