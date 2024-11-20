# xnew
![](introduction.png)  
<center>
<p>xnew is a javascript library for component based programming.</p>
<p>Suitable for creating apps and games with dynamic scenes.</p>
</center>

## Setup
### cdn
```
<script src="https://unpkg.com/xnew@1.5.x/dist/xnew.js"></script>;
```

### npm
```
npm install xnew
```
```
import { xnew } from 'xnew'
```
## Basic usage
The library contains a function `xnew`.  
By setting a component function, it will create an instance(`node`) of the component.  
```
const node = xnew(Component, ...args);    
```
```
function Component(node, ...args) {
    // implement features
}
```
`...args` is arguments for the component function. (not necessary)

You can also use an function literal.  
```
const node = xnew((node) => {
    // ...
});
```
### impementation of the component function
Inside the component function, you can implement initializing and repeated updating, finalizing process et al. 
And you can define your own functions and properties here and use them later.  
```
function Component(node) {
    // initialize
    // ...

    return {
        update() {
            // executed repeatedly at the rate available for rendering.
            // ...
        },
        finalize() {
            // fires when node.finalize() is called.
            // note that it is also called automatically when the parent node finalizes.
            // ...
        },

        hoge() {
            // original function (accessed by node.hoge())
            // ...
        },
    }
}
```
### parent-child relationship
If you call `xnew` inside a component function, a parent-child relationship is connected.
![](parent-child.png)
```
xnew((node) => {
    xnew(A);
    xnew(B);
    // ...
});

function A(node) {
    xnew(C);
    // ...
}

function B(node) {
    // ...
}

function C(node) {
    // ...
}
```
The conencted xnodes will work together.
For example, when the parent component finalizes, its children also finalizes.   
The updating process works in the order of [child] -> [parent].

<br>

Next: [manual](#manual) for detailed explanation.
