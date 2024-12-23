---
sidebar_position: 8
---

# xnew.self
`xnew.self` get the created `xnode`.

## example
```js
xnew(() => {
  const xnode1 = xnew.self;

  const xnode2 = xnew(() => {
    const xnode2 = xnew.self;

    // ...
  });  
});
```

## scope issues
In `xnew` arguments, `parent` can be omitted.  
However in some callback functions, appropriate parent xnode may not be set.  
In such cases, the first argument should be set intentionally.  

- appropriate parent is set  
  In the following, other xnodes are created as children of `xnode1`.
```js
xnew(() => {
  const xnode1 = xnew.self;

  const xnode2 = xnew(Component);
  xnode2.parent; // xnode1

  xnode1.on('click', () => {
    const xnode3 = xnew(Component);
    xnode3.parent; // xnode1;
  });

  setTimeout(() => {
    const xnode4 = xnew(xnode1, Component);
    xnode4.parent; // xnode1;
  }, 1000);

  xnew.timer(() => {
    const xnode5 = xnew(Component);
    xnode5.parent; // xnode1;
  }, 1000);
});
```

- appropriate parent is not(?) set  
  In the following, other xnodes are not created as children of `xnode1`.
```js
xnew(() => {
  const xnode1 = xnew.self;

  // not xnode method
  window.addEventListener('click', () => {
    const xnode2 = xnew(Component);
    xnode2.parent; // null
  });

  // parent xnode is not set
  setTimeout(() => {
    const xnode3 = xnew(Component);
    xnode3.parent; // null
  }, 1000);

  const another = xnew(Component);
  another.on('click', () => {
    const xnode4 = xnew(Component);
    xnode4.parent; // another
  });
})
```
