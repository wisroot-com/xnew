# xnew
![](introduction.png)  
<center>
<p>xnew is a javascript library for component based programming.</p>
<p>Suitable for a dynamic web site, web games and animation.</p>
</center>

## Setup
### cdn
```
<script src="https://unpkg.com/xnew@1.6.x/dist/xnew.js"></script>;
```

### npm
```
npm install xnew
```
```
import { xnew } from 'xnew'
```
## Basic usage
By setting a component function to `xnew`, an instance(`xnode`) of the component will be created.  
```
const xnode = xnew(Component);    
```
```
function Component(xnode) {
    // implement features
}
```

You can also use a function literal.  
```
const xnode = xnew((xnode) => {
    // ...
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
        xnew((xnode) => {
            xnode.nest({ style: 'position: absolute; width: 200px; height: 200px; inset: 0; margin: auto; background: #08F;'})
            const text = xnew({ tag: 'span' }, 'start');

            xnode.on('pointerdown', () => {
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
        });
    </script>
</body>
</html>
```
## Parent-Child relationship
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
        xnew((xnode) => {
            xnew(Parent);
        });

        function Parent(xnode) {
            xnode.nest({ style: 'position: absolute; width: 200px; height: 200px; inset: 0; margin: auto; background: #08F;'})
            const text = xnew({ tag: 'span' }, 'parent: start');

            xnew(Child);

            xnode.on('pointerdown', () => {
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
            xnode.nest({ style: 'position: absolute; width: 100px; height: 100px; inset: 0; margin: auto; background: #F80;' })
            const text = xnew({ tag: 'span' }, 'child: start');
     
            xnode.on('pointerdown', (event) => {
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
The updating process works in the order of [child] -> [parent].
