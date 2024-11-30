# manual

## Arguments
As shown below, `xnew` accepts some arguments.

```
// parent:    [a xnode object]
// element:   [an existing html element] or [attributes to create a html element]  
// component: [an component function] or [an inner html for a created html element]  
// ...args:   [arguments for the component function]

xnew(parent, element, component, ...args);

```
<br>

`parent` and `element` are often omitted.  

```
xnew(component, ...args);           // parent and element are omitted
xnew(parent, component, ...args);   // element is omitted
xnew(element, component, ...args);  // parent is omitted
```
<br>

If you omit the `parent` parameter, the nesting higher xnode or otherwise `null` is assigned.   
    
```
xnew((xnode1) => {
    // xnode1.parent: null

    const xnode2 = xnew((xnode2) => {
        // xnode2.parent: xnode1
    });

    xnew(xnode2, (xnode3) => {
        // xnode3.parent: xnode2
    });
})
```
<br>

`element` is set for the html element of the new xnode. (accessed by `xnode.element`)  
e.g. `xnew(document.querySelector('#hoge'), component)`  
e.g. `xnew({ tag: 'div', style: '', ... }, component)`   
If you omit the tag property, `tag: 'div'` will be set automatically.  

If you omit the `element` parameter, the parent xnode's element or otherwise `document.body` is assigned. 
    
```
<div id="hoge"></div>

<script>
    xnew((xnode1) => {
        // xnode1.element: document.body
    });

    xnew(document.querySelector('#hoge'), (xnode2) => {
        // xnode2.element: (id=hoge)

        xnew((xnode3) => {
            // xnode3.element: (id=hoge)
        });

        xnew({ tag: 'div', id: 'fuga' }, (xnode4) => {
            // xnode4.element: (id=fuga) (as a child element of hoge)
        });
    });
</script>;
```
<br>

If you set string as `component`, innerHTML will be added in a created element.

```
const xnode = xnew({ tag: 'p', id: 'hoge' }, 'aaa');

// xnode.element: (id=hoge)
// xnode.element.innerHTML: aaa
```

        
## Element
There are various ways to create elements.
### `xnode.nest`
This create a new element as a child of the current element. and replace `xnode.element`.
```
xnode.nest(attributes);
// e.g.: xnode.nest({ tag: 'div', type: 'aaa', class: 'bbb', style: 'color: #000;' });
```
### example
```
xnew({ tag: 'div', name: 'A'}, (xnode1) =>{
    // xnode1.element: (div A)
});

xnew((xnode2) => {
    xnode2.nest({ tag: 'div', name: 'B' });
    // xnode2.element: (div B)
}

xnew({ tag: 'div', name: 'C' }, (xnode3) => { 
    xnode3.nest({ tag: 'div', name: 'D' }); // inner div
    // xnode3.element: (div D)
    // xnode3.element.parentElement: (div C)
}

const xnode4 = xnew({ tag: 'div', name: 'E' }, 'aaa');
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
xnodes has some system properties for basic control. You can define the detail in the response of the component function.

```
const xnode = xnew((xnode) => {

    return {
        promise: new Promise((resolve, reject) => {
            // update will not start until this promise is resolved. (accessed by xnode.promise)
        }), 
        start() {
            // fires before first update.
        },
        update(time) {
            // executed repeatedly at the rate available for rendering.
            // time: elapsed time from start
        },
        stop() {
            // fires when xnode.stop is called.
        },
        finalize() {
            // fires when xnode.finalize() is called.
            // note that it is also called automatically when the parent xnode finalizes.
        },
    }
});

xnode.start();    // start update loop
xnode.stop();     // stop update loop
xnode.finalize(); // current xnode and the child xnodes will be finalized 

xnode.state;      // [pending -> running <-> stopped -> finalized] 
```
- xnodes automatically calls `xnode.start()`.  
  If you want to avoid it, call `xnode.stop()` inside the component function.  
- connected xnodes(parent-child relationship) work together. 
  e.g. the parent component finalizes, its children also finalizes.  
    
## Original properties
You can define original properties unless the properties are already defined.

```
const xnode = xnew((xnode) =>  {
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
### `xnode.extend`
```
xnode.extend(component, ...args);
```
### example

```
// base component function
function Base(xnode) {
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
const xnode = xnew((xnode) => {
    xnode.extend(Base);

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
    However, By using the return value of `xnode.extend`, you can change it to execute both.

```
const xnode = xnew((xnode) => {
    const props = xnode.extend(Base);

    return {
        update() {
            console.log('derived update');
            xnode.stop();
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
## Event listener
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
const xnode = xnew((xnode) => {
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
- If you add `#` token (e.g. `xnode.emit('#myevent')`), it emit to all xnodes. this message can be received by using xnode.on('#myevent').

## Find xnode
Once an xnode has a key, you can look it up anywhere.

### `xnode.key`
```
xnode.key = 'string';
```
            
### `xfind`
`xfind` searches in all xnodes. 
```
const xnodes = xfind(key);
```

### example
```
xnew((xnode1) => {
    xnode1.key = 'aaa';
});

xnew((xnode2) => {
    xnode2.key = 'bbb';
});

xnew((xnode3) => {
    xnode3.key = 'bbb ccc';
});

xfind('aaa'); // [xnode1]
xfind('bbb'); // [xnode2, xnode3]
xfind('ccc'); // [xnode3]
xfind('aaa bbb'); // [xnode1, xnode2, xnode3]         
```

## Scope 
`parent`(the first argument of xnew) can be omitted.  
However, in callback functions, appropriate parent xnode may not be automatically set.  
In such cases, the first argument should be set intentionally.  
            
```
xnew((xnode1) => {
    // ----------------------------------------
    // appropriate parent is set
    // ----------------------------------------

    // parent: xnode1; 
    xnew(component);

    xnode1.on('click', () => {
        // parent: xnode1; 
        xnew(component);
    });

    setTimeout(() => {
        // parent: xnode1; 
        xnew(xnode1, component);
    }, 1000);

    xscope(xnode1, setTimeout, () => {
        // parent: xnode1; 
        xnew(component);
    }, 1000);


    // ----------------------------------------
    // appropriate parent is not(?) set
    // ----------------------------------------

    // not xnode method
    window.addEventListener('click', () => {
        // parent: null; 
        xnew(component);
    });

    // parent xnode is not set
    setTimeout(() => {
        // parent: null; 
        xnew(component);
    }, 1000);

    const xnode2 = xnew(component);
    xnode2.on('click', () => {
        // parent: xnode2; 
        xnew(component);
    });
})
```

## Shared data
You can use `xnode.shared` when you want to share data among xnodes connected by parent-child relationship.
### `xnode.shared`

### example
```
xnew((xnode1) =>  {
    xnode1.shared.hoge = 1;

    xnew((xnode2) =>  {
        xnode2.shared.hoge; // 1
    });
});
```
## Context
You can use context property when you want to get properties on higher xnode.

### `xnode.context`
```
// set
xnode.context(name, value);
// get
xnode.context(name);

```

### example
```
xnew((xnode) => {
    xnode.context('hoge', 1); // undefined (return previus value)
    xnode.context('hoge');    // 1

    xnew((xnode) => {
        xnode.context('hoge'); // 1

        xnew((xnode) => {
            xnode.context('hoge', 2); // 1 (return previus value)
            xnode.context('hoge');    // 2

            xnew((xnode) => {
                xnode.context('hoge'); // 2
            });
        });
        
        xnode.context('hoge'); // 1
    });
});
```