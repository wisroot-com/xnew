---
sidebar_position: 3
---

# xnew.extend
it extend the component function using another one.

```js
xnew.extend(component, ...args);
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
  xnew.extend(Base);

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
If system properties (`promise`, `start`, `update`, `stop`, `finalize`) defined in both component functions,
  the properties are automatically merged.
:::
:::tip
If original properties defined in both component functions,
  the properties are overridden.
:::

By using the return value of `xnew.extend`, you can change the calling rules of the original properties.

```js
const xnode = xnew(() => {
  const props = xnew.extend(Base);

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
