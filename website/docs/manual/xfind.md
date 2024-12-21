---
sidebar_position: 7
---

# xfind
`xfind` find xnodes using key string or a component function.

## usage
```js
xfind(key | component); // key string or component function
```

## `xnode.key`
```js
xnode.key = 'string';
```            
 
```js
const xnodes = xfind(key);
```

## example
```js
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
