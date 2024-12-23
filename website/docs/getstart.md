---
sidebar_position: 1
---

# get start

**Get start xnew in less than 5 minutes**.


## introcuntion
![](/img/introduction.svg)  

xnew is a JavaScript library for component oriented programming.  
You can architect your code as a collection of simple components.  

## setup
### via cdn
```html
<script src="https://unpkg.com/xnew@2.0.x/dist/xnew.js"></script>
```

### via cdn (ESM)
```html
<script type="importmap">
{
  "imports": {
    "xnew": "https://unpkg.com/xnew@2.0.x/dist/xnew.mjs"
  }
}
</script>

<script type="module">
import { xnew } from 'xnew'

// ...

</script>
```

### via npm
```bash
npm install xnew@2.0.x
```
```js
import { xnew } from 'xnew'
```
## tutorial
### basic usage
By setting a component function to `xnew`, an instance `xnode` will be created.  
In that function, you will implement various features.

```js
const xnode = xnew(Component);    

function Component() {
  const xnode = xnew.current; // you can get xnode from inside.
  // ...
  // implement features
}
```

You can also use a function literal.  `xnew(() => { });`
```js
const xnode = xnew(() => {
  const xnode = xnew.current;
  // ...
  // implement features
});
```

### example 1
You can create html elements using `xnew` and `xnew.nest`.  

<iframe style={{width:'100%',height:'120px',border:'solid 1px #AAA',borderRadius:'6px'}} src="/xnew/examples/getstart1.html" ></iframe>

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="https://unpkg.com/xnew@2.0.x/dist/xnew.js"></script>
</head>
<body>
  <script>
    xnew(Div);

    function Div() {
      xnew.nest({ style: 'margin: 4px; padding: 4px; border: solid 1px #222;'});

      xnew({ tagName: 'p' }, 'my div');
      xnew(Divs);
    }

    function Divs() {
      xnew.nest({ style: 'display: flex;'});
   
      xnew({ style: 'width: 160px; height: 36px; background: #d66;'}, '1');
      xnew({ style: 'width: 160px; height: 36px; background: #6d6;'}, '2');
      xnew({ style: 'width: 160px; height: 36px; background: #66d;'}, '3');
    }
  </script>
</body>
</html>
```

### example 2
You can implement various process in the componet function.   
Click on the square below.

<iframe style={{width:'100%',height:'300px',border:'solid 1px #AAA',borderRadius:'6px'}} src="/xnew/examples/box.html" ></iframe>

```html
<body>
  <script>
    xnew(Component);

    function Component() {
      xnew.nest({ style: 'position: absolute; width: 200px; height: 200px; inset: 0; margin: auto; background: #08F;'});
      
      const text = xnew({ tagName: 'span' });

      const xnode = xnew.current;
      xnode.on('click', (event) => {
          xnode.state === 'running' ? xnode.stop() : xnode.start();
      });

      let counter = 0;
      return {
        start() {
          text.element.textContent = 'start';
        },
        update() {
          xnode.element.style.transform = `rotate(${counter++}deg)`;
        },
        stop() {
          text.element.textContent = 'stop';
        },
      };
    }
  </script>
</body>
```
### example 3
If you call `xnew` inside a component function, a parent-child relationship is connected.  
The conencted xnodes will work together.  
For example, when the parent component stop, its children also stop.   

<iframe style={{width:'100%',height:'300px',border:'solid 1px #AAA',borderRadius:'6px'}} src="/xnew/examples/boxinbox.html" ></iframe>

```html
<body>
  <script>
    xnew(Parent);

    function Parent() {
      xnew.nest({ style: 'position: absolute; width: 200px; height: 200px; inset: 0; margin: auto; background: #08F;'});

      const text = xnew({ tagName: 'span' });

      xnew(Child);

      const xnode = xnew.current;
      xnode.on('click', () => {
        xnode.state === 'running' ? xnode.stop() : xnode.start();
      });

      let counter = 0;
      return {
        start() {
          text.element.textContent = 'parent: start';
        },
        update() {
          xnode.element.style.transform = `rotate(${counter++}deg)`;
        },
        stop() {
          text.element.textContent = 'parent: stop';
        },
      };
    }

    function Child() {
      xnew.nest({ style: 'position: absolute; width: 100px; height: 100px; inset: 0; margin: auto; background: #F80;' });

      const text = xnew({ tagName: 'span' });

      const xnode = xnew.current;
      xnode.on('click', (event) => {
        event.stopPropagation();
        xnode.state === 'running' ? xnode.stop() : xnode.start();
      });

      let counter = 0;
      return {
        start() {
          text.element.textContent = 'child: start';
        },
        update() {
          xnode.element.style.transform = `rotate(${counter++}deg)`;
        },
        stop() {
          text.element.textContent = 'child: stop';
        },
      };
    }
  </script>
</body>
```