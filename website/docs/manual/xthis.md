---
sidebar_position: 8
---

# xthis
`xthis` get the created `xnode`.

## usage 

```js
xnew(() => {
  const xnode1 = xthis();

  const xnode2 = xnew(() => {
    const xnode2 = xthis();

    // ...
  });  
});
```

## example
In `xnew` arguments, `parent` can be omitted.
However, in callback functions, appropriate parent xnode may not be automatically set.  
In such cases, the first argument should be set intentionally.  

- appropriate parent is set
```js
xnew(() => {
  const xnode1 = xthis();

  const xnode2 = xnew(component);
  xnode2.parent; // xnode1

  xnode1.on('click', () => {
    // xthis() == xnode1 

    const xnode3 = xnew(component);
    xnode3.parent; // xnode1;
  });

  setTimeout(() => {
    // xthis() == null 

    const xnode4 = xnew(xnode1, component);
    xnode4.parent; // xnode1;
  }, 1000);

  xtimer(() => {
    // xthis() == xnode1 

    const xnode5 = xnew(component);
    xnode5.parent; // xnode1;
  }, 1000);
});
```

- appropriate parent is not(?) set
```js
xnew(() => {
  const xnode1 = xthis();

  // not xnode method
  window.addEventListener('click', () => {
    // xthis() == null

    const xnode2 = xnew(component);
    xnode2.parent; // null
  });

  // parent xnode is not set
  setTimeout(() => {
    // xthis() == null
  
    const xnode3 = xnew(component);
    xnode3.parent; // null
  }, 1000);

  const xnode5 = xnew(component);
  xnode5.on('click', () => {
    // xthis() == xnode5

    const xnode6 = xnew(component);
    xnode6.parent; // xnode5
  });
})
```
