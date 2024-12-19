# manual

## Arguments
As shown below, `xnew` accepts some arguments.

```
// parent:    [a xnode object]
// element:   [an existing html element] or [attributes to create a html element]  
// component: [an component function] or [an inner html for the created html element]  
// ...args:   [arguments for the component function]

xnew(parent, element, component, ...args);

```
<br>

These arguments are often omitted.  

```
// e.g.
xnew(component, ...args);           // parent and element are omitted
xnew(parent, component, ...args);   // element is omitted
xnew(element, component, ...args);  // parent is omitted
xnew(parent, element);              // component is omitted
...
```
<br>

If you omit the `parent` parameter, the nesting higher xnode or otherwise `null` is assigned.   
    
```
const xnode1 = xnew(() => {
    // xthis().parent: null

    const xnode2 = xnew(() => {
        // xthis().parent: xnode1
    });
    const xnode3 = xnew(() => {
        // xthis().parent: xnode1
    });
    const xnode4 = xnew(xnode2, () => {
        // xthis().parent: xnode2
    });
})
```
<br>

`element` is set for the html element of the new xnode. (accessed by `xnode.element`)  
- Setting an existing html element  
e.g. `xnew(document.querySelector('#hoge'), component)`  or `xnew('#hoge', component)`   
- Creating a new html element   
e.g. `xnew({ tagName: 'div', className: '', style: '', ... }, component)`   

If you omit the tagName property, `tagName: 'div'` will be set automatically.  

If you omit the `element` parameter, the parent xnode's element or otherwise `document.body` is assigned. 
    
```
<div id="hoge"></div>

<script>
    xnew(() => {
        // xthis().element: document.body
    });

    xnew('#hoge', () => {
        // xthis().element: (id=hoge)

        xnew(() => {
            // xthis().element: (id=hoge)
        });

        xnew({ tagName: 'div', id: 'fuga' }, () => {
            // xthis().element: (id=fuga) (as a child element of hoge)
        });
    });
</script>;
```
<br>

If you set string as `component`, innerHTML will be added in a created element.

```
const xnode = xnew({ tagName: 'p', id: 'hoge' }, 'aaa');

// xnode.element: (id=hoge)
// xnode.element.innerHTML: aaa
```

        
## Element
There are various ways to create elements.
### `xnest`
This create a new element as a child of the current element. and replace `xnode.element`.
```
xnest(attributes);
// e.g.: xnest({ tagName: 'div', type: 'aaa', className: 'bbb', style: 'color: #000;' });
```
### example
```
xnew({ tagName: 'div', name: 'A'}, () =>{
    // xthis().element: (div A)
});

xnew(() => {
    xnest({ tagName: 'div', name: 'B' });
    // xthis().element: (div B)
}

xnew({ tagName: 'div', name: 'C' }, () => { 
    xnest({ tagName: 'div', name: 'D' }); // inner div
    // xthis().element: (div D)
    // xthis().element.parentElement: (div C)
}

const xnode4 = xnew({ tagName: 'div', name: 'E' }, 'aaa');
// xnode4.element: (div E)
// xnode4.element.textContent: aaa
```
The above code leads to the following result.
```
<body>
    <div name="A"></div>
    <div name="B"></div>
    <div name="C">
        <div name="D"></div>
    </div>
    <div name="E">
        aaa
    </div>
</body>
```
Note that the created elements are removed when the xnodes finalize.
            
## System properties
`xnode` has some system properties for basic control. You can define the detail in the response of the component function.

```
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
This method start update loop.  
xnodes automatically calls `xnode.start()`. If you want to avoid it, call `xnode.stop()` inside the component function.  
```
xnode.start();
```

### `xnode.stop`
This method stop update loop.
```
xnode.stop();
```

### `xnode.finalize`
This method finalize the xnode and the children.  
Related elements will be deleted and update processing will also stop.
```
xnode.finalize();
```

- `start`, `stop`, `finalize`, Connected xnodes(parent-child relationship) work together. 
  e.g. the parent component finalizes, its children also finalizes.  

### `xnode.reboot`
This method reboot the xnode using the component function. 
```
xnode.reboot(...args); // ...args for the component function.
```

### `xnode.state`
A variable that represents the internal state of the xnode.   
[pending -> running <-> stopped -> finalized] 
```
xnode.state.
```

## Original properties
You can define original properties unless the properties are already defined.  
(excepting `promise`, `start`, `update`, `stop`, `finalize`, `reboot`, `on`, `off`, `emit`, `key`, `element`, `parent`, `_`)

```

const xnode = xnew(() =>  {
    let counter = 0;

    return {
        countup () {
            counter++;
        },
        // setter
        set counter(value) {
            counter = value;
        },
        // getter
        get counter() {
            return counter;
        }
    }
});

xnode.countup();         // 0 -> 1
xnode.counter = 2;       // setter
const x = xnode.counter; // getter
```

## Extend
You can create a component function that extends another component function.
### `xextend`
```
xextend(component, ...args);
```
### example

```
// base component function
function Base() {
    return {
        update() {
            console.log('base update');
        },
        hoge() {
            console.log('base hoge');
        },
    }
}
```
```
const xnode = xnew(() => {
    xextend(Base);

    return {
        update() {
            console.log('derived update');
        },
        hoge() {
            console.log('derived hoge');
        },
    }
});

xnode.hoge();
// derived hoge (overridden)

// base update
// derived update
```
- System properties defined in both component functions are automatically merged.
- Original properties defined in both component functions are overridden.
    However, By using the return value of `xextend`, you can change it to execute both.

```
const xnode = xnew(() => {
    const props = xextend(Base);

    return {
        update() {
            console.log('derived update');
            xthis().stop();
        },
        hoge() {
            props.hoge(); // execute Base component hoge
            console.log('derived hoge');
        },
    }
});

xnode.hoge();
// base hoge
// derived hoge

// base update
// derived update
```

## Timer
`xtimer` create a timer that execute a callback function for a specified time.

### `xtimer`
```
xtimer(callback, delay, loop = false);
```
### example

```
xnew(() => {
    const timer = xtimer(() => {
        // This function is called after 100 ms.
    }, 100);

    // If you cancel the timer, call bellow.
    // timer.clear();
});

```

- If the parent xnode finalize, the timer is automatically cleared.

## Listener
You can set the event listener using `xnode.on`, and fire original event using `xnode.emit`.

### `xnode.on`
This add a event listener.
```
xnode.on(type, callback);
```
### `xnode.off`
This remove event listeners.
```
xnode.off(); // clear all events
xnode.off(type); // clear events (named type)
xnode.off(type, callback); // clear the callback event
```
### `xnode.emit`
This emit a event.
```
xnode.emit(type, ...args);
```

### example
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

## Find
You can find xnodes using key string or component functions.

### `xnode.key`
```
xnode.key = 'string';
```
            
### `xfind`
`xfind` searches in all xnodes.
```
xfind(key | component); // key string or component function
```
 
```
const xnodes = xfind(key);
```

### example
```
xnew(() => {
    xthis().key = 'aaa';
});

xnew(() => {
    xthis().key = 'bbb';
});

xnew(() => {
    xthis().key = 'bbb ccc';
});

xfind('aaa'); // [xnode1]
xfind('bbb'); // [xnode2, xnode3]
xfind('ccc'); // [xnode3]
xfind('aaa bbb'); // [xnode1, xnode2, xnode3]        

const xnode4 = xnew(A);

function A() {
}

xfind(A); // [xnode4]        


```

## Scope 
In `xnew` arguments, `parent` can be omitted.
However, in callback functions, appropriate parent xnode may not be automatically set.  
In such cases, the first argument should be set intentionally.  

### example
            
```
xnew(() => {
    const xnode1 = xthis();

    // ----------------------------------------
    // appropriate parent is set
    // ----------------------------------------

    // parent: xnode1
    xnew(component);

    xnode1.on('click', () => {
        // parent: xnode1 
        xnew(component);
    });

    setTimeout(() => {
        // parent: xnode1 (Must be set explicitly)
        xnew(xnode1, component);
    }, 1000);

    xtimer(() => {
        // parent: xnode1
        xnew(component);
    }, 1000);

    // ----------------------------------------
    // appropriate parent is not(?) set
    // ----------------------------------------

    // not xnode method
    window.addEventListener('click', () => {
        // parent: null
        xnew(component);
    });

    // parent xnode is not set
    setTimeout(() => {
        // parent: null
        xnew(component);
    }, 1000);

    const xnode2 = xnew(component);
    xnode2.on('click', () => {
        // parent: xnode2
        xnew(component);
    });
})
```

## Context
You can use context property when you want to get properties on higher xnode.

### `xcontext`
```
// set
xcontext(name, value);
// get
xcontext(name);

```

### example
```
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