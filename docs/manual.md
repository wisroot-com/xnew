# manual

Read [Basic usage](#) first

## Arguments of xnew
As shown below, `xnew` accepts some arguments.

```
function xnew (parent, element, Component, ...args);
```

- `parent` and `element` are often omitted.  
    In that case they will be set automatically.
    ```
    xnew(Component, ...args);           // parent and element are omitted
    xnew(parent, Component, ...args);   // element are omitted
    xnew(element, Component, ...args);  // parent are omitted
    ```

- `parent`: object (a node) or null  
    This is set as the parent node of the new node. (accessed by `node.parent`)  
    If you omit this `parent` parameter, the nesting higher node or otherwise `null` is assigned.   
    ```
    xnew((node1) => {
        // node1.parent: null 
        // This means that node1 is a root node

        xnew((node2) => {
            // node2.parent: node1
        });

        xnew(node2, (node3) => {
            // node3.parent: node2
        });
    })
    ```

- `element`: object (an existing html element or attributes to create a html element)  
    This is set for the html element of the new node. (accessed by `node.element`)  
    e.g. `xnew(document.querySelector('#hoge'), Component)`  
    e.g. `xnew({ tag: 'div', style: '', ... }, Component)` (a new element is created)  
    If you omit this `element` parameter, the parent node's element or otherwise `document.body` is assigned. 
    ```
    <body>
        <div id="hoge"></div>;

        <script>
            xnew((node1) => {
                // node1.element: document.body
            });

            xnew(document.querySelector('#hoge'), (node2) => {
                // node2.element: (id=hoge)

                xnew((node3) => {
                    // node3.element: (id=hoge)
                });

                xnew({ tag: 'div', id: 'fuga' }, (node4) => {
                    // node4.element: (id=fuga) (as a child element of hoge)
                });
            });
        </script>;
    </body;
    ```
    You can set any attributes parameter like below.  
    `e.g. { tag: 'div', type: 'aaa', class: 'bbb', style: 'color: #000;' }`  
    If you omit tag property, `tag: 'div'` will be set automatically.  
- `Component`: function  
    Inside this function, the new node features are implemented.  

- `...args`: arguments for Component function
<br>

You can also use the following format as a supplementary usage.
```
function xnew (parent, element, innerHTML);
```
- `innerHTML`: string
    ```
    const node = xnew({ tag: 'div', id: 'hoge' }, `<p>text</p>`);

    // node.element: (id=hoge)
    // node.element.innerHTML: <p>text</p>
    ```
        
## Element
There are various ways to create elements. Here are some patterns.
### `node.nestElement`
This create a new element as a child of the current element. and replace `node.element`.
```
node.nestElement(attributes);
// e.g.: node.nestElement({ tag: 'div', type: 'aaa', class: 'bbb', style: 'color: #000;' });
```
### example
```
<body>
    <script>
        xnew({ tag: 'div', name: 'A'}, (node1) =>{
            // node1.element: (div A)
        });

        xnew((node2) => {
            node2.nestElement({ tag: 'div', name: 'B' });
            // node2.element: (div B)
        }

        xnew({ tag: 'div', name: 'C' }, (node3) => { 
            node3.nestElement({ tag: 'div', name: 'D' }); // inner div
            // node3.element: (div D)
            // node3.element.parentElement: (div C)
            // ...
        }

        const node4 = xnew({ tag: 'div', name: 'E' }, `<p>aaa</p>`);
        // node4.element: (div E)
        // node4.element.innerHTML: <p>aaa</p>

        const node5 = xnew(`<p>bbb</p>`); 
        // node5.element: (div)
    </script>
</body>       
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
        <p>aaa</p>
    </div>
    <div>
        <p>bbb</p>
    </div>
</body>
```
- Note that the created elements are removed when the nodes finalize.
            
## System properties
nodes has some system properties for basic control. You can define the detail in the response of the component function.

```
const node = xnew((node) => {

    return {
        promise: new Promise((resolve, reject) => {
            // update will not start until this promise is resolved. (accessed by node.promise)
        }), 
        start() {
            // fires before first update.
        },
        update(time) {
            // executed repeatedly at the rate available for rendering.
            // time: elapsed time from start
        },
        stop() {
            // fires when node.stop is called.
        },
        finalize() {
            // fires when node.finalize() is called.
            // note that it is also called automatically when the parent node finalizes.
        },
    }
});

node.start();    // start update loop
node.stop();     // stop update loop
node.finalize(); // current node and the child nodes will be finalized 

node.isStarted();   // return boolean 
node.isStopped();   // ...
node.isFinalized(); // ...
```
- By default, nodes automatically calls `node.start()`.  
    If you want to avoid it, call `node.stop()` inside the component function.  
- connected nodes(parent-child relationship) work together.  
    - When the parent component finalizes, its children also finalizes.  
    - `start`, `update`, `stop` process works in the order of [child] -> [parent].  
    
## Original properties
You can define original properties unless the properties are already defined.

```
const node = xnew((node) =>  {
    let counter = 0;

    return {
        countUp () {
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

node.countUp(); // 0 -> 1
node.counter = 2;       // setter
const x = node.counter; // getter
```

## Extend
You can create a component function that extends another component function.
### `node.extend`
```
node.extend(Component, ...args);
```
### example

```
// base component function
function Base(node) {
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
const node = xnew((node) => {
    // extend base component function
    node.extend(Base);

    return {
        update() {
            console.log('derived update');
        },
        hoge() {
            console.log('derived hoge');
        },
    }
});

node.hoge();
// derived hoge (overridden)

// base update
// derived update
```
- System properties defined in both component functions are automatically merged.
- Original properties defined in both component functions are overridden.
    However, By using the return value of `node.extend`, you can change it to execute both.

```
const node = xnew((node) => {
    // extend Base component
    const defines = node.extend(Base);

    return {
        update() {
            console.log('derived update');
            node.stop();
        },
        hoge() {
            defines.hoge(); // execute Base component hoge
            console.log('derived hoge');
        },
    }
});

node.hoge();
// base hoge
// derived hoge

// base update
// derived update
```
## Event listener
You can set the event listener using `node.on`, and fire original event using `node.emit`.

### `node.on`
This add a event listener.
```
node.on(type, callback);
```
### `node.off`
This remove event listeners.
```
node.off(); // clear all events
node.off(type); // clear events (named type)
node.off(type, callback); // clear the callback event
```
### `node.emit`
This emit a event.
```
node.emit(type, ...args);
```

### example
```
const node = xnew((node) => {
    node.on('click', (event) => {
        // fires when the node's element is clicked.
    });

    // original event
    node.on('myevent', (data) => {
        // fires when node.emit('myevent') is called.
    });

    // node.off(); // unset all listeners in the node
    // node.off('myevent'); // unset 'myevent'
});

node.emit('myevent', data); 
```
- `node.emit('myevent')` emits only to self node, and not to other nodes.
- If you add `#` token (e.g. `node.emit('#myevent')`), it emit to all nodes. this message can be received by using node.on('#myevent').

## Timer
By setting timer, you can execute time delay functions.
### `xtimer`
```
const timer = xtimer(callback, delay, repeat);
```
### example

```
xnew((node) =>  {
    // call only once (1000ms delay)
    const timer1 = xtimer(() => {
        // ...
    }, 1000);

    // call repeatedly (1000ms interval)
    const timer2 = xtimer(() => {
        // ...
    }, 1000, true);
});
```
- Timers can be canceled by calling `timer.finalize()`.
- Timers are automatically canceled when `node.finalize()` is called.

## Find node
Once an node has a key, you can look it up anywhere.

### `node.key`
```
node.key = 'string';
```
            
### `xfind`
`xfind` searches in all nodes. 
```
const nodes = xfind(key);
```

### example
```
xnew((node1) => {
    node1.key = 'aaa';
});

xnew((node2) => {
    node2.key = 'bbb';
});

xnew((node3) => {
    node3.key = 'bbb ccc';
});

xfind('aaa'); // [node1]
xfind('bbb'); // [node2, node3]
xfind('ccc'); // [node3]
xfind('aaa bbb'); // [node1, node2, node3]         
```

## Notes for parent node 
`parent`(the first argument of xnew) can be omitted.  
However, in callback functions, appropriate parent node may not be automatically set.  
In such cases, the first argument should be set intentionally.  
            
```
xnew((node1) => {
    // ----------------------------------------
    // appropriate parent is set
    // ----------------------------------------

    // parent: node1; 
    xnew(Component);

    node1.on('click', () => {
        // parent: node1; 
        xnew(Component);
    });

    xtimer(() => {
        // parent: node1; 
        xnew(Component);
    }, 1000);


    // ----------------------------------------
    // appropriate parent is not(?) set
    // ----------------------------------------

    // not node method
    window.addEventListener('click', () => {
        // parent: null; 
        xnew(Component);
    });

    // not xtimer
    setTimeout(() => {
        // parent: null; 
        xnew(Component);
    }, 1000);


    const node2 = xnew(Component);

    node2.on('click', () => {
        // parent: node2; 
        xnew(Component);
    });
})
```

## Shared data
You can use `node.shared` when you want to share data among nodes connected by parent-child relationship.
### example
```
xnew((node1) =>  {
    node1.shared.hoge = 1;

    xnew((node2) =>  {
        node2.shared.hoge; // 1
    });
});
```
## Context
You can use context property when you want to get properties on higher node.
### `node.setContext`
```
node.setContext(name, value);
```
### `node.getContext`
```
node.getContext(name);
```

### example
```
xnew((node) => {
    node.setContext('hoge', 1);
    node.getContext('hoge'); // 1

    xnew((node) => {
        node.getContext('hoge'); // 1

        xnew((node) => {
            node.setContext('hoge', 2);
            node.getContext('hoge'); // 2

            xnew((node) => {
                node.getContext('hoge'); // 2
            });
        });
        
        node.getContext('hoge'); // 1
    });
});
```