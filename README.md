# xnew
xnew is a javascript library for component based programming.  
You can build your program as a collection of simple components.

[**xnew website**](https://wisroot-com.github.io/xnew)

## setup

### via cdn  
  
```html
<script src="https://unpkg.com/xnew@2.0.x/dist/xnew.js"></script>
```

### via cdn (ESM)

```html
<script type="importmap">
{
    "imports": {
        "xnew": "https://unpkg.com/xnew@2.0.x/dist/xnew.mjs"
    }
}
</script>

<script type="module">
import { xnew, xthis, xnest, xextend, xcontext, xfind, xtimer, xbasics } from 'xnew'

// ...

</script>
```

### via npm
```bash
npm install xnew@2.0.x
```
```js
import { xnew, xthis, xnest, xextend, xcontext, xfind, xtimer, xbasics } from 'xnew'
```
