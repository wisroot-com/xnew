---
sidebar_position: 6
---

# xnew.context
You can use context property when you want to get properties on higher xnode.
```js
// set
xnew.context(name, value);
// get
xnew.context(name);
```
## example
```js
xnew(() => {
  xnew.context('hoge', 1);
  xnew.context('hoge');    // 1

  xnew(() => {
    xnew.context('hoge'); // 1

    xnew(() => {
      xnew.context('hoge', 2);
      xnew.context('hoge');    // 2

      xnew(() => {
        xnew.context('hoge'); // 2
      });
    });
    
    xnew.context('hoge'); // 1
  });
});
```