# xnew.js
xnew is a javascript library for component based programming.  
Suitable for a dynamic web site, web games and animation.

[**xnew website**](https://wisroot-com.github.io/xnew.js)

## setup

### via cdn  
  
```
<script src="https://unpkg.com/xnew@1.6.x/dist/xnew.js"></script>
```

### via cdn (ESM)

```
<script type="importmap">
{
    "imports": {
        "xnew": "https://unpkg.com/xnew@1.6.x/dist/xnew.mjs"
    }
}
</script>

<script type="module">
import { xnew, xnest, xextend, xcontext, xfind, xtimer, xbasics } from 'xnew'

// ...

</script>
```

### via npm
```
npm install xnew@1.6.x
```
```
import { xnew, xnest, xextend, xcontext, xfind, xtimer, xbasics } from 'xnew'
```
