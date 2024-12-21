---
sidebar_position: 1
---

# get start

Let's discover **xnew in less than 5 minutes**.


## introcuntion
![](/img/introduction.svg)  

xnew is a JavaScript library for component oriented programming.  
You can build your program as a collection of simple components.  

Let's start by looking at various examples. [examples](/xnew/docs/examples/cube)
## Setup
### via cdn
```html
<script src="https://unpkg.com/xnew@2.0.x/dist/xnew.js"></script>;
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
import { xnew, xthis, xnest, xextend, xcontext, xfind, xtimer, xbasics } from 'xnew'

// ...

</script>
```

### via npm
```bash
npm install xnew@2.0.x
```
```js
import { xnew, xthis, xnest, xextend, xcontext, xfind, xtimer, xbasics } from 'xnew'
```
## Tutorial
### Basic usage
By setting a component function to `xnew`, an instance `xnode` will be created.  
```js
const xnode = xnew(Component);    

function Component() {
    const xnode = xthis(); // you can get xnode from inside.
    // ...
    // implement features
}
```

You can also use a function literal.  `() => { //... }`
```js
const xnode = xnew(() => {
    const xnode = xthis();
    // ...
    // implement features
});
```

### example 1
You can create html elements using `xnew` and `xnest`.  
(The detailed mechanism is explained on the next page.)

<iframe style={{width:'100%',height:'200px',border:'solid 1px #AAA',borderRadius:'6px'}} src="/xnew/examples/getstart1.html" ></iframe>

```html
<body>
  <script>
    xnew(Div);

    function Div() {
      xnest({ style: 'margin: 4px; padding: 4px; border: solid 1px #222;'});

      xnew({ tagName: 'p' }, 'my div');
      xnew(Divs);
    }

    function Divs() {
      xnest({ style: 'display: flex;'});
   
      xnew({ style: 'width: 160px; height: 36px; background: #d66;'}, '1');
      xnew({ style: 'width: 160px; height: 36px; background: #6d6;'}, '2');
      xnew({ style: 'width: 160px; height: 36px; background: #66d;'}, '3');
    }
  </script>
</body>
```

### example 2
And you can implement various process.   
Click on the square below.

<iframe style={{width:'100%',height:'300px',border:'solid 1px #AAA',borderRadius:'6px'}} src="/xnew/examples/box.html" ></iframe>

```html
<body>
  <script>
    xnew(Component);

    function Component() {
      xnest({ style: 'position: absolute; width: 200px; height: 200px; inset: 0; margin: auto; background: #08F;'});
      
      const text = xnew({ tagName: 'span' });

      const xnode = xthis();
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
      xnest({ style: 'position: absolute; width: 200px; height: 200px; inset: 0; margin: auto; background: #08F;'});

      const text = xnew({ tagName: 'span' });

      xnew(Child);

      const xnode = xthis();
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
      xnest({ style: 'position: absolute; width: 100px; height: 100px; inset: 0; margin: auto; background: #F80;' });

      const text = xnew({ tagName: 'span' });

      const xnode = xthis();
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