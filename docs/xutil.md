# xutil

## xutil.input
[key code](https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_code_values)

```
// check key state
xnew((xnode) => {

    return {
        update() {
            if (xutil.input.getKeyDown('KeyA')) {
                console.log('key A is just pressed down');
            }

            if (xutil.input.getKeyUp('KeyA')) {
                console.log('key A is just released up');
            }

            if (xutil.input.getKey('KeyA')) {
                console.log('key A is pressed');
            }

        },
    }
});
```