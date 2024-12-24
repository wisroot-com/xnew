---
sidebar_position: 4
---

# xnew.timer
`xnew.timer` create a timer that execute a callback function for a specified time.

```js
xnew.timer(callback, delay, loop = false);
```
## example

```js
xnew(() => {
  const timer = xnew.timer(() => {
    // This function is called after 100 ms.
  }, 100);

  // If you cancel the timer, call bellow.
  // timer.clear();
});

```
:::tip
If the parent xnode finalize, the timer is automatically cleared.
:::
