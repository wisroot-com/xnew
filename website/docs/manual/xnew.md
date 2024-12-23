---
sidebar_position: 1
---

# xnew
`xnew` create a new `xnode`.  
This function is the starting point of component-oriented programming.

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
xnew(parent, target);               // Component is omitted
...
```

First, let's set only the component function.  
In the component function, you will implement various features.  

```js
const xnode = xnew(Component);    

function Component() {
  const xnode = xnew.self; // you can get xnode from inside.
  // ...
  // implement features
}
```

You can also use a function literal.  `xnew(() => { });`
```js
const xnode = xnew(() => {
  const xnode = xnew.self;
  // ...
  // implement features
});
```
## parent
If you omit the `parent` parameter, the nesting higher xnode or otherwise `null` is assigned.   
    
```js
xnew(() => {
  // xnode1.parent: null
  const xnode1 = xnew.self;

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
## target
`target` is set for the html element of the new xnode.  
The element is accessed by `xnode.element`.

- Setting an existing html element  
e.g. `xnew(document.querySelector('#hoge'), ...)` or `xnew('#hoge', ...)`
```html
<body>
  <div id="hoge"></div>
  <script>
    const xnode = xnew('#hoge', () => {
      const xnode = xnew.self;

      xnode.element; // element (id = hoge)
    });
  </script>
</body>
```

- Creating a new html element   
e.g. `xnew({ tagName: 'div', className: 'aaa', style: 'bbb', }, ...)`
```html
<body>
  <script>
    const xnode = xnew({ tagName: 'div', id: 'hoge' }, () => {
      const xnode = xnew.self;
      
      xnode.element; // element (id = hoge)
    });
  </script>
</body>
```

If you omit the tagName property, `tagName: 'div'` will be set automatically.  

If you omit the `element` parameter, the parent xnode's element or otherwise `document.body` is assigned. 
    
```html
<div id="hoge"></div>

<script>
  xnew(() => {
    // xnew.self.element: document.body
  });

  xnew('#hoge', () => {
    // xnew.self.element: (id=hoge)

    xnew(() => {
      // xnew.self.element: (id=hoge)
    });

    xnew({ tagName: 'div', id: 'fuga' }, () => {
      // xnew.self.element: (id=fuga) (as a child element of hoge)
    });
  });
</script>;
```

## innerHTML
If you set string as `Compoennt`, innerHTML will be added in a created element.
```js
const xnode = xnew({ tagName: 'p', id: 'hoge' }, 'aaa');

// xnode.element: (id=hoge)
```
```html
<body>
  <p id="hoge">
    aaa
  </p>
</body>
```
