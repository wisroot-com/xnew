# xnew
![](introduction.png)  
<center>
<p>xnew is a javascript library for component based programming.</p>
<p>Suitable for creating apps and games with dynamic scenes.</p>
</center>

## Setup
### cdn
```
<script src="https://unpkg.com/xnew@1.x/dist/xnew.js"></script>;
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

You can also use an function literal.  
```
const xnode = xnew((xnode) => {
    // ...
});
```
### impementation of the component function
Inside the component function, you can implement initializing and repeated updating, finalizing process et al. 
And you can define your own functions and properties here and use them later.  
```
function Component(xnode) {
    // initialize
    // ...

    return {
        update() {
            // executed repeatedly at the rate available for rendering.
            // ...
        },
        finalize() {
            // fires when xnode.finalize() is called.
            // note that it is also called automatically when the parent xnode finalizes.
            // ...
        },

        hoge() {
            // original function (accessed by xnode.hoge())
            // ...
        },
    }
}
```
### parent-child relationship
If you call `xnew` inside a component function, a parent-child relationship is connected.
![](parent-child.png)
```
xnew((xnode) => {
    xnew(A);
    xnew(B);
    // ...
});

function A(xnode) {
    xnew(C);
    // ...
}

function B(xnode) {
    // ...
}

function C(xnode) {
    // ...
}
```
The conencted xnodes will work together.
For example, when the parent component finalizes, its children also finalizes.   
The updating process works in the order of [child] -> [parent].

<br>

Next: [manual](#manual) for detailed explanation.
