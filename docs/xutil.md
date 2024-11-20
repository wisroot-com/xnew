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
## xutil.audio
load audio file  
```
const music = xutil.audio.load('music.mp3');

// start music
music.play();

// Promise
music.promise.then(() => console.log('loaded'));

// volume 0.0 ~ 1.0
music.volume = 1.0;

music.loop = true;

// stop music (offset [ms])
const offset = music.stop();

// restart music from offset
music.play(offset)
```
create a synthesizer

```
const synth = xutil.audio.create({
    oscillator: {
        type: 'square',
        // envelope: { amaount: 0, ADSR: [200, 200, 0.2, 200], },
        // LFO: { type: 'square', amaount: 4, rate: 8, },
    },
    filter: {
        type: 'lowpass',
        cutoff: 1000,
        // envelope: { amaount: 0, ADSR: [200, 200, 0.2, 200], },
        // LFO: { type: 'square', amaount: 4, rate: 8, },
    },
    amp: {
        envelope: { amaount: 0.1, ADSR: [200, 200, 0.2, 1000], },
        // LFO: { type: 'square', amaount: 0.1, rate: 8, },
    },
});

synth.press(440, 500); // frequency = 440hz, duration = 500ms
synth.press(440, 500, 1200); // frequency = 440hz, duration = 500ms, wait = 1200ms

const press = synth.press(440); // frequency = 440hz
// ...
press.release();
```