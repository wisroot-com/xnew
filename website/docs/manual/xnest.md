---
sidebar_position: 2
---

# xnest
`xnest` create a new element as a child of the current element.  
You can access it by `xnode.element` or return value.

```js
const newElement = xnest(attributes);
// e.g.: attributes = { tagName: 'div', className: 'bbb', style: 'color: #000;' };
```
## example
```js
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
```html
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
            