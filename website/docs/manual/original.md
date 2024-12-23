---
sidebar_position: 4
---

# original properties
You can define original properties unless the properties are already defined.  
The following names are not available.
- `promise`, `start`, `update`, `stop`, `finalize`, `reboot`
- `parent`,  `element`, `on`, `off`, `emit`, `key`, `_`
## example

```js
const xnode = xnew(() =>  {
  let counter = 0;

  return {
    countup () {
      counter++;
    },
    set counter(value) { // setter
      counter = value;
    },
    get counter() { // getter
      return counter;
    }
  }
});

xnode.countup();         // 0 -> 1
xnode.counter = 2;       // setter
const x = xnode.counter; // getter
```
