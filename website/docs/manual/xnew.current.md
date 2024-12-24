---
sidebar_position: 7
---

# xnew.current
`xnew.current` get the created `xnode`.

## example
```js
xnew(() => {
  const xnode1 = xnew.current;

  const xnode2 = xnew(() => {
    const xnode2 = xnew.current;

    // ...
  });  
});
```

## scope issues
In some callback functions, appropriate parent xnode may not be set.  

:::note
In the following, appropriate parent is set.
the xnodes are created as children of `xnode1`.
```js
xnew(() => {
  const xnode1 = xnew.current;

  const xnode2 = xnew(Component);
  xnode2.parent; // xnode1

  xnode1.on('click', () => {
    const xnode3 = xnew(Component);
    xnode3.parent; // xnode1;
  });

  xnew.timer(() => {
    const xnode4 = xnew(Component);
    xnode4.parent; // xnode1;
  }, 1000);


  // use callback functions except for xnode method
  setTimeout(() => {
    const xnode5 = xnew(xnode1, Component); // parent xnode is set intentionally
    xnode5.parent; // xnode1;
  }, 1000);

  window.addEventListener('click', () => {
    const xnode6 = xnew(xnode1, Component); // parent xnode is set intentionally
    xnode6.parent; // xnode1
  });
});
```
:::

:::warning
In the following, appropriate parent is not(?) set.  
the xnodes are not created as children of `xnode1`.
```js
xnew(() => {
  const xnode1 = xnew.current;

  // use callback functions except for xnode method
  window.addEventListener('click', () => {
    const xnode2 = xnew(Component); // parent xnode is not set
    xnode2.parent; // null
  });

  setTimeout(() => {
    const xnode3 = xnew(Component); // parent xnode is not set
    xnode3.parent; // null
  }, 1000);



  const another = xnew(Component);
  another.on('click', () => {
    const xnode4 = xnew(Component);
    xnode4.parent; // another
  });
})
```
:::
