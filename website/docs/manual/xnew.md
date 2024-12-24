---
sidebar_position: 1
---

# xnew
`xnew` create a new `xnode`.  
This function is the starting point of component-oriented programming.
## basic usage
### arguments
As shown below, `xnew` accepts some arguments.
```js
// parent:    [a xnode object]
// target:    [an existing html element] or [attributes to create a html element]  
// Component: [an component function] or [an inner html for the created html element]  
// ...args:   [arguments for the component function]
const xnode = xnew(parent, target, Component, ...args);
```

These arguments are often omitted.  
```js
// e.g.
xnew(Component, ...args);           // parent and target are omitted
xnew(parent, Component, ...args);   // target is omitted
xnew(target, Component, ...args);   // parent is omitted
xnew(parent, target);               // ...
xnew(parent);                       // ...
xnew(target);                       // ...
xnew();                             // ...
...
```

### Component
First, let's set only the component function.  
By setting a component function to `xnew`, you will implement various features.  

```js
const xnode = xnew(Component, ...args);    

function Component(...args) {
  const xnode = xnew.current; // you can get xnode from inside.
  // ...
  // implement features
}
```

You can also use a function literal.  `xnew(() => { });`
```js
const xnode = xnew(() => {
  const xnode = xnew.current;
  // ...
  // implement features
});
```

### parent
`parent` parameter is set as parent `xnode`.  
If you omit the `parent` parameter, the nesting higher xnode or otherwise `null` is assigned.   
    
```js
xnew(() => {
  // xnode1.parent: null
  const xnode1 = xnew.current;

  // xnode2.parent: xnode1
  const xnode2 = xnew(() => {
  });

  // xnode3.parent: xnode1
  const xnode3 = xnew(() => {
  });

  // xnode4.parent: xnode2
  const xnode4 = xnew(xnode2, () => {
  });
})
```
### target
`target` is set for the html element of the new xnode. The element is accessed by `xnode.element`.

#### Setting an existing html element  
```html
<body>
  <div id="hoge"></div>
  <script>
    const xnode = xnew('#hoge', () => {
      const xnode = xnew.current;

      xnode.element; // element (id = hoge)
    });
  </script>
</body>
```
:::note Setting variations
- `xnew('#hoge', ...)` string
- `xnew(document.querySelector('#hoge'), ...)` HTMLElement
- `xnew(window, ...)` Document
- `xnew(document, ...)` Windwow
:::

#### Creating a new html element   
```html
<body>
  <script>
    const xnode = xnew({ tagName: 'div', id: 'hoge' }, () => {
      const xnode = xnew.current;
      
      xnode.element; // element (id = hoge)
    });
  </script>
</body>
```

:::note Setting variations
- `xnew({ tagName: 'div', className: 'aaa', style: 'bbb', }, ...)`  
:::

If you omit the tagName property, `tagName: 'div'` will be set automatically.  
If you omit the `element` parameter, the parent xnode's element or otherwise `document.body` is assigned. 
    
```html
<div id="hoge"></div>

<script>
  xnew(() => {
    // xnew.current.element: document.body
  });

  xnew('#hoge', () => {
    // xnew.current.element: (id=hoge)

    xnew(() => {
      // xnew.current.element: (id=hoge)
    });

    xnew({ tagName: 'div', id: 'fuga' }, () => {
      // xnew.current.element: (id=fuga) (as a child element of hoge)
    });
  });
</script>;
```

### innerHTML
If you set string as `Compoennt`, innerHTML will be added in a created element.
```js
const xnode = xnew({ tagName: 'p', id: 'hoge' }, 'aaa');
```
```html
<body>
  <p id="hoge">
    aaa
  </p>
</body>
```

## system properties
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

### `xnode.start`
This method start update loop. xnodes automatically calls `xnode.start()`.  
If you want to avoid it, call `xnode.stop()` inside the component function.  
```js
xnode.start();
```

### `xnode.stop`
This method stop update loop.
```js
xnode.stop();
```

### `xnode.finalize`
This method finalize the xnode and the children.  
Related elements will be deleted and update processing will also stop.
```js
xnode.finalize();
```

### `xnode.reboot`
This method reboot the xnode using the component function. 
```js
xnode.reboot(...args); // ...args for the component function.
```

### `xnode.state`
This variable represents the state of the xnode.
```js
xnode.state; // [pending → running ↔ stopped → finalized] 
```

### calling order
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
```

```js
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


## original properties
You can define original properties unless the properties are already defined.  
The following names are not available.
- `promise`, `start`, `update`, `stop`, `finalize`, `reboot`, `state`
- `parent`,  `element`, `on`, `off`, `emit`, `key`, `_`

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


## event listener
You can set event listeners using `xnode.on`.
Your original event is fired using `xnode.emit`.

```js
const xnode = xnew(() => {
  const xnode = xnew.current;
  xnode.on('click', (event) => {
    // fires when the xnode's element is clicked.
  });

  // original event
  xnode.on('myevent', (data) => {
    // fires when xnode.emit('myevent', data) is called.
  });

  // xnode.off(); // unset all listeners in the xnode
  // xnode.off('myevent'); // unset 'myevent'
});

const data = {};
xnode.emit('myevent', data); 
```
### `xnode.on`
This method set a event listener.
```js
xnode.on(type, callback);
```
### `xnode.off`
This method remove event listeners.
```js
xnode.off();                // clear all events
xnode.off(type);            // clear events (named type)
xnode.off(type, callback);  // clear the callback event
```
### `xnode.emit`
This method emit a event.
```js
xnode.emit(type, ...args);
```
### broadcast
If you add `~` token, `xnode.emit` broadcasts to all xnodes.  
```js
xnew(() => {
  const xnode1 = xnew.current;
  xnode1.on('~myevent', () => {
    //
  });
});

xnew(() => {
  const xnode2 = xnew.current;
  xnode2.emit('~myevent'); // broadcast event
});

```
