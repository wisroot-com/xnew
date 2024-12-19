# xnew.js
![](introduction.png)  
<center>
<p>xnew.js is a javascript library for component oriented programming.</p>
<p>Suitable for a dynamic web site, web games and animation.</p>
</center>

## Setup
### via cdn
```
<script src="https://unpkg.com/xnew@2.0.x/dist/xnew.js"></script>;
```

### via cdn (ESM)
```
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
```
npm install xnew
```
```
import { xnew, xthis, xnest, xextend, xcontext, xfind, xtimer, xbasics } from 'xnew'
```
## Basic usage
By setting a component function to `xnew`, an instance `xnode` will be created.  
```
const xnode = xnew(Component);    

function Component() {
    const xnode = xthis(); // you can get xnode from inside.
    // implement features
}
```

You can also use a function literal.  
```
const xnode = xnew(() => {
    const xnode = xthis();
    // implement features
});
```
## Basic example 1

Inside the component function, you can create html elements. 

<iframe src="./examples/getstart1.html" style="width: 400px; height: 300px; border: solid 1px #AAA; margin: auto;"></iframe>

```
<body>
    <script>
        xnew(Div);

        function Div() {
            xnest({ tagName: 'div', style: 'margin: 4px; padding: 4px; border: solid 1px #222;'});

            xnew({ tagName: 'p' }, 'my div');
            xnew({ tagName: 'div', style: 'display: flex;'}, () => {
                xnew({ tagName: 'div', style: 'width: 160px; height: 36px; background: #d66;'}, '1');
                xnew({ tagName: 'div', style: 'width: 160px; height: 36px; background: #6d6;'}, '2');
                xnew({ tagName: 'div', style: 'width: 160px; height: 36px; background: #66d;'}, '3');
            });
        }
    </script>
</body>
```

## Basic example 2
And you can implement various process. 

<iframe src="./examples/box.html" style="width: 400px; height: 300px; border: solid 1px #AAA; margin: auto;"></iframe>

```
<body>
    <script>
        xnew(Component);

        function Component() {
            xnest({ tagName: 'div', style: 'position: absolute; width: 200px; height: 200px; inset: 0; margin: auto; background: #08F;'})
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
## Basic example 3
If you call `xnew` inside a component function, a parent-child relationship is connected.  
The conencted xnodes will work together.
For example, when the parent component stop, its children also stop.   

<iframe src="./examples/boxinbox.html" style="width: 400px; height: 300px; border: solid 1px #AAA; margin: auto;"></iframe>

```
<body>
    <script>
        xnew(Parent);

        function Parent() {
            xnest({ style: 'position: absolute; width: 200px; height: 200px; inset: 0; margin: auto; background: #08F;'})
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
            xnest({ style: 'position: absolute; width: 100px; height: 100px; inset: 0; margin: auto; background: #F80;' })
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

