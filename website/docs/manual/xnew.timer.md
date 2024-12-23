---
sidebar_position: 6
---

# xnew.timer
`xnew.timer` create a timer that execute a callback function for a specified time.

## arguments
```
xnew.timer(callback, delay, loop = false);
```
### example

```
xnew(() => {
    const timer = xnew.timer(() => {
        // This function is called after 100 ms.
    }, 100);

    // If you cancel the timer, call bellow.
    // timer.clear();
});

```

- If the parent xnode finalize, the timer is automatically cleared.
