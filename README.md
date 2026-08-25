# xnew
`xnew` is a JavaScript / TypeScript library for component-oriented programming,
providing a flexible architecture well-suited for applications with dynamic scenes and games.

[**Visit the xnew website**](https://mulsense.github.io/xnew)

<div>
    <img src="docusaurus/static/img/mascot.gif" width="500" alt="xnew introduction" />
</div>

## Setup

### Via CDN
Use the ES module version with an import map:
```html
<script type="importmap">
{
    "imports": {
        "@mulsense/xnew": "https://unpkg.com/@mulsense/xnew@0.9.x/dist/xnew.mjs"
    }
}
</script>

<script type="module">
import { xnew } from '@mulsense/xnew';

// Your code here
</script>
```

### Via npm
Install `xnew` using npm:
```bash
npm install @mulsense/xnew@0.9.x
```

Then import it in your JavaScript file:
```js
import { xnew } from '@mulsense/xnew';
```

## Building a game

[**xnew-gamelab**](https://github.com/mulsense/xnew-gamelab) is a template repository for
making games with `xnew`. It ships a small but complete game (title / play / game over,
with input, collision, effects and sound) together with the documentation an AI coding
agent needs to extend it — supported by Claude Code, GitHub Copilot and Codex.

```bash
git clone https://github.com/mulsense/xnew-gamelab
cd xnew-gamelab
npm install
npm run dev
```
