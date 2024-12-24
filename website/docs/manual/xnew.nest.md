---
sidebar_position: 2
---

# xnew.nest
`xnew.nest` create a new element as a child of the current element.  
It replace `xnode.element`.

```js
xnew(() => {
  const xnode = xnew.current;

  const element = xnew.nest(attributes);
  // You can access the created element by xnode.element or return value.
})
```

## example 1
```js
xnew({ tagName: 'div', name: 'A'}, () =>{
  // xnew.current.element: (div A)
});

xnew(() => {
  xnew.nest({ tagName: 'div', name: 'B' });
  // xnew.current.element: (div B)
}

xnew({ tagName: 'div', name: 'C' }, () => { 
  // xnew.current.element: (div C)
  xnew.nest({ tagName: 'div', name: 'D' }); // inner div
  // xnew.current.element: (div D)
  // xnew.current.element.parentElement: (div C)
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

:::note
The created elements are removed when the xnodes finalize.
:::

## example 2

<iframe style={{width:'100%',height:'500px',border:'solid 1px #DDD',borderRadius:'6px'}} src="/xnew/examples/element.html" ></iframe>

```html
<div id="main"></div>
<script>
  xnew('#main', () => {
    xnew(Div1);
    xnew(Div2);
    xnew(Div3);
    xnew(Div4);
  });

  function BaseDiv(name) {
    xnew.nest({ tagName: 'div', style: 'margin: 4px; padding: 4px; border: solid 1px #222;' });
    xnew({ tagName: 'p' }, name);
  }

  function Div1() {
    xnew.extend(BaseDiv, 'my div');

    xnew({ style: 'display: flex;' }, () => {
      xnew({ style: 'width: 160px; height: 36px; background: #d66;' }, '1');
      xnew({ style: 'width: 160px; height: 36px; background: #6d6;' }, '2');
      xnew({ style: 'width: 160px; height: 36px; background: #66d;' }, '3');
    });
  }

  function Div2() {
    xnew.extend(BaseDiv, 'my button');

    const button = xnew({ tagName: 'button' }, 'click me');

    let counter = 0;
    button.on('click', () => {
      button.element.textContent = `counter: ${counter++}`;
    })
  }

  function Div3() {
    xnew.extend(BaseDiv, 'my input text');

    const input = xnew({ tagName: 'input', type: 'text' });
    const span = xnew({ tagName: 'span' });

    input.on('change input', () => {
      span.element.textContent = input.element.value;
    })
  }

  function Div4() {
    xnew.extend(BaseDiv, 'my canvas');

    const canvas = xnew({ tagName: 'canvas', width: 200, height: 100 });
    
    const ctx = canvas.element.getContext('2d');
    const cx = canvas.element.width / 2;
    const cy = canvas.element.height / 2;
    const s = Math.min(cx, cy) * 0.5;

    ctx.fillStyle = "rgb(0,0,0)";
    ctx.fillRect(0, 0, canvas.element.width, canvas.element.height);

    ctx.fillStyle = "rgb(200,0,100)";
    ctx.fillRect(cx - 0.6 * cx - s, cy - s, s * 2, s * 2);

    ctx.fillStyle = "rgb(100,200,0)";
    ctx.fillRect(cx + 0.0 * cx - s, cy - s, s * 2, s * 2);

    ctx.fillStyle = "rgb(0,100,200)";
    ctx.fillRect(cx + 0.6 * cx - s, cy - s, s * 2, s * 2);
  }

</script>
```