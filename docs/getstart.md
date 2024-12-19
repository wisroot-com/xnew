# xnew.js
![](introduction.png)  
<center>
<p>xnew.js is a javascript library for component oriented programming.</p>
<p>Suitable for a dynamic web site, web games and animation.</p>
</center>

## Setup
### via cdn
```
<script src="https://unpkg.com/xnew@1.6.x/dist/xnew.js"></script>;
```

### via cdn (ESM)
```
<script type="importmap">
{
    "imports": {
        "xnew": "https://unpkg.com/xnew@1.6.x/dist/xnew.mjs"
    }
}
</script>

<script type="module">
import { xnew, xnest, xextend, xcontext, xfind, xtimer, xbasics } from 'xnew'

// ...

</script>
```

### via npm
```
npm install xnew
```
```
import { xnew, xnest, xextend, xcontext, xfind, xtimer, xbasics } from 'xnew'
```
## Basic usage
By setting a component function to `xnew`, an instance `xnode` will be created.  
```
const xnode = xnew(Component);    

function Component(xnode) {
    // implement features
}
```

You can also use a function literal.  
```
const xnode = xnew((xnode) => {
    // implement features
});
```
## Basic example
Inside the component function, you can implement various process. 

<iframe src="./examples/box.html" style="width: 400px; height: 300px; border: solid 1px #AAA; margin: auto;"></iframe>

```
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <script src="https://unpkg.com/xnew@1.6.x/dist/xnew.js"></script>
</head>
<body>
    <script>
        xnew(Component);

        function Component(xnode) {
            xnest({ tagName: 'div', style: 'position: absolute; width: 200px; height: 200px; inset: 0; margin: auto; background: #08F;'})
            const text = xnew({ tagName: 'span' }, 'parent: start');

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
</html>
```
## Relationship
If you call `xnew` inside a component function, a parent-child relationship is connected.

<iframe src="./examples/boxinbox.html" style="width: 400px; height: 300px; border: solid 1px #AAA; margin: auto;"></iframe>

```
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <script src="https://unpkg.com/xnew@1.6.x/dist/xnew.js"></script>
</head>
<body>
    <script>
        xnew(Parent);

        function Parent(xnode) {
            xnest({ style: 'position: absolute; width: 200px; height: 200px; inset: 0; margin: auto; background: #08F;'})
            const text = xnew({ tagName: 'span' }, 'parent: start');

            xnew(Child);

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

        function Child(xnode) {
            xnest({ style: 'position: absolute; width: 100px; height: 100px; inset: 0; margin: auto; background: #F80;' })
            const text = xnew({ tagName: 'span' }, 'child: start');
     
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
</html>
```
The conencted xnodes will work together.
For example, when the parent component stop, its children also stop.   
