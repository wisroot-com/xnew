---
sidebar_position: 1
---

# xnew
`xnew` create a new `xnode`.

## usage
As shown below, `xnew` accepts some arguments.

```js
// parent:    [a xnode object]
// target:    [an existing html element] or [attributes to create a html element]  
// component: [an component function] or [an inner html for the created html element]  
// ...args:   [arguments for the component function]

xnew(parent, target, component, ...args);
```

These arguments are often omitted.  

```js
// e.g.
xnew(component, ...args);           // parent and target are omitted
xnew(parent, component, ...args);   // target is omitted
xnew(target, component, ...args);   // parent is omitted
xnew(parent, target);               // component is omitted
...
```
## parent
If you omit the `parent` parameter, the nesting higher xnode or otherwise `null` is assigned.   
    
```js
// xnode1.parent: null
const xnode1 = xnew(() => {

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
The set element is accessed by `xnode.element`.

- Setting an existing html element  
```html
<body>
  <div id="hoge"></div>

  <script>
    const xnode = xnew(document.querySelector('#hoge'), () => {
      const xnode = xthis();

      xnode.element; // element (id = hoge)
    });

    // or
    // xnew('#hoge', ...);
  </script>
</body>
```

- Creating a new html element   
```html
<body>

  <script>
    const xnode = xnew({ tagName: 'div', id: 'hoge' }, () => {
      const xnode = xthis();
      
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

## component
If you set a function as `component`, various functions can be implemented within the function.

```js
const xnode = xnew(Component);

function Component() {
  const xnode = xthis();
  // ...
  // implement features
}
```


If you set string as `component`, innerHTML will be added in a created element.

```js
const xnode = xnew({ tagName: 'p', id: 'hoge' }, 'aaa');

// xnode.element: (id=hoge)
// xnode.element.innerHTML: aaa
```
