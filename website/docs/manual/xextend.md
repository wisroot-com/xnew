---
sidebar_position: 5
---

# xextend
You can create a component function that extends another component function.
## arguments
```
xextend(component, ...args);
```
## example

```js
// base component function
function Base() {
  return {
    update() {
      console.log('base update');
    },
    hoge() {
      console.log('base hoge');
    },
  }
}
```
```js
const xnode = xnew(() => {
  xextend(Base);

  return {
    update() {
      console.log('derived update');
    },
    hoge() {
      console.log('derived hoge');
    },
  }
});

xnode.hoge();
// derived hoge

// base update
// derived update

// ... update loop

```
:::tip

- If system properties (`promise`, `start`, `update`, `stop`, `finalize`) defined in both component functions,
  the properties are automatically merged.
- If original properties defined in both component functions,
  the properties are overridden.
:::

By using the return value of `xextend`, you can change the calling rules of the original properties.

```js
const xnode = xnew(() => {
  const props = xextend(Base);

  return {
    hoge() {
      props.hoge(); // execute Base component hoge
      console.log('derived hoge');
    },
  }
});

xnode.hoge();
// base hoge
// derived hoge

```
