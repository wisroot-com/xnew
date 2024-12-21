---
sidebar_position: 9
---

# xcontext
You can use context property when you want to get properties on higher xnode.

## usage 
```js
// set
xcontext(name, value);
// get
xcontext(name);
```
## example
```js
xnew(() => {
  xcontext('hoge', 1);
  xcontext('hoge');    // 1

  xnew(() => {
    xcontext('hoge'); // 1

    xnew(() => {
      xcontext('hoge', 2);
      xcontext('hoge');    // 2

      xnew(() => {
        xcontext('hoge'); // 2
      });
    });
    
    xcontext('hoge'); // 1
  });
});
```