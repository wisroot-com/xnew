---
sidebar_position: 7
---

# listener
You can set the event listener using `xnode.on`, and fire original event using `xnode.emit`.

## `xnode.on`
This add a event listener.
```
xnode.on(type, callback);
```
## `xnode.off`
This remove event listeners.
```
xnode.off(); // clear all events
xnode.off(type); // clear events (named type)
xnode.off(type, callback); // clear the callback event
```
## `xnode.emit`
This emit a event.
```
xnode.emit(type, ...args);
```

## example
```
const xnode = xnew(() => {
    const xnode = xthis();
    xnode.on('click', (event) => {
        // fires when the xnode's element is clicked.
    });

    // original event
    xnode.on('myevent', (data) => {
        // fires when xnode.emit('myevent') is called.
    });

    // xnode.off(); // unset all listeners in the xnode
    // xnode.off('myevent'); // unset 'myevent'
});

xnode.emit('myevent', data); 
```
- `xnode.emit('myevent')` emits only to self xnode, and not to other xnodes.
- If you add `~` token, it broadcasts to all xnodes. (e.g. `xnode1.emit('~myevent')` -> `xnode2.on('~myevent')`)
