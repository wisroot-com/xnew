---
sidebar_position: 2
---

# xnew.nest
`xnew.nest` create a new element as a child of the current element.  

```js
xnew(() => {
  const element = xnew.nest(attributes);
  // You can access the created element by xnew.self.element or return value.
})
```

## example
```js
xnew({ tagName: 'div', name: 'A'}, () =>{
  // xnew.self.element: (div A)
});

xnew(() => {
  xnew.nest({ tagName: 'div', name: 'B' });
  // xnew.self.element: (div B)
}

xnew({ tagName: 'div', name: 'C' }, () => { 
  // xnew.self.element: (div C)
  xnew.nest({ tagName: 'div', name: 'D' }); // inner div
  // xnew.self.element: (div D)
  // xnew.self.element.parentElement: (div C)
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

:::tip

The created elements are removed when the xnodes finalize.

:::


:::tip

When setting class of the element, use `className` instead of `class`.  
`xnew.nest({ className: 'myclass' });`

:::