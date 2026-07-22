# 1_xnew — features of `@mulsense/xnew`

Samples for everything importable from the `@mulsense/xnew` package itself
(no addons). Grouped by the package's exports plus applied showcases.

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
| [stage](basics/stage/) | `Screen` settings (normal / fit / contain / cover) swapped by `Scene.change`, driven from a `Panel` |
| [element](basics/element/) | `Button` / `Input*` form elements — `@layer base` defaults, overridable via className / style |
| [widget](basics/widget/) | `ColorPicker` / `Panel` / `Gate` + `Accordion` / `Overlay` (accordion, modal, menu) / `VirtualPad` |
| [svg](basics/svg/) | `SVG` icon base, `GraphicText` outlined labels |

## audio/ — export `xaudio`

| sample | shows |
| --- | --- |
| [audiotrack](audio/audiotrack/) | `xaudio.load` music playback, `xaudio.volume` master gain |
| [synthesizer](audio/synthesizer/) | `xaudio.synthesizer` interactive keyboard playground |
| [soundeffect](audio/soundeffect/) | `xaudio.synthesizer` recipes for game sound effects |

## icons/ — export `xicons`

| sample | shows |
| --- | --- |
| [list](icons/list/) | the full heroicons set (324 icons) — `mode: 'outline' / 'solid'`, colored via `currentColor` |
| [frame](icons/frame/) | framing an icon with a bordered `<div>` wrapper (circle / square / rounded) |

## sync/ — export `xsync`

| sample | shows |
| --- | --- |
| [multiplay](sync/multiplay/) | lobby / room / synced game over socket.io — run `npm install && npm start` inside the folder |

## showcase/ — applied samples

| sample | shows |
| --- | --- |
| [mascot](showcase/mascot/) | the xnew mascots (circle / triangle / square) — slime-like idle wobble + squash-and-stretch jump |
| [typewriter](showcase/typewriter/) | dialog box with a typewriter text stream |
| [screenshot](showcase/screenshot/) | capturing the screen to a PNG (html2canvas) |

## manual/

Minimal snippets embedded in the website documentation (`website/docs/manual/getstarted.md`).
