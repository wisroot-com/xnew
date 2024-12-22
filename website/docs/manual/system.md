---
sidebar_position: 3
---

# system properties
`xnode` has some system properties for basic control.  
You can define the detail in the response of the component function.

```js
const xnode = xnew(() => {
  // initialize

  return {
    promise: new Promise((resolve, reject) => {
      // update will not start until this promise is resolved. (accessed by xnode.promise)
    }), 
    start() {
      // fires before first update.
    },
    update() {
      // executed repeatedly at the rate available for rendering.
    },
    stop() {
      // fires when xnode.stop() is called.
    },
    finalize() {
      // fires when xnode.finalize() is called.
      // note that it is also called automatically when the parent xnode finalizes.
    },
  }
});

```

## `xnode.start`
This method start update loop. xnodes automatically calls `xnode.start()`.  
If you want to avoid it, call `xnode.stop()` inside the component function.  
```js
xnode.start();
```

## `xnode.stop`
This method stop update loop.
```js
xnode.stop();
```

## `xnode.finalize`
This method finalize the xnode and the children.  
Related elements will be deleted and update processing will also stop.
```js
xnode.finalize();
```

## `xnode.reboot`
This method reboot the xnode using the component function. 
```js
xnode.reboot(...args); // ...args for the component function.
```

## `xnode.state`
This variable represents the state of the xnode.
```js
xnode.state; // [pending → running ↔ stopped → finalized] 
```

## calling order
`start`, `update`, `stop`, `finalize`, these methods have a calling order.  
The parent xnode method is called after the children xnode method is called.

```js
const parent = xnew(Patent);

function Parent() {
  xnew(Child1);
  xnew(Child2);

  return {
    start() { console.log('Parent start'); },
    update() { console.log('Parent update'); },
    stop() { console.log('Parent stop'); },
    finalize() { console.log('Parent finalize'); },
  }
}

function Child1() {
  return {
    start() { console.log('Child1 start'); },
    update() { console.log('Child1 update'); },
    stop() { console.log('Child1 stop'); },
    finalize() { console.log('Child1 finalize'); },
  }
}

function Child2() {
  return {
    start() { console.log('Child2 start'); },
    update() { console.log('Child2 update'); },
    stop() { console.log('Child2 stop'); },
    finalize() { console.log('Child2 finalize'); },
  }
}

// Child1 start
// Child2 start
// Parent start

// Child1 update
// Child2 update
// Parent update

// ... update loop

parent.stop();
// Child1 stop
// Child2 stop
// Parent stop

parent.finalize();
// Child1 finalize
// Child2 finalize
// Parent finalize
```
