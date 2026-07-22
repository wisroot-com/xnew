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
