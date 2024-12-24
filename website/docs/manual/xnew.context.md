---
sidebar_position: 6
---

# xnew.context
`xnew.context` is for context property when you want to get properties on higher xnode.

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