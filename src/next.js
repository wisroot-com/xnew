
import { isString, isNumber, isObject, isFunction } from './common';
import { xnew, XNode } from './core';

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
//----------------------------------------------------------------------------------------------------
// audio
//----------------------------------------------------------------------------------------------------

export const audio = (() => {
    const context = new (window.AudioContext || window.webkitAudioContext)();

    window.addEventListener('touchstart', initialize, true);
    window.addEventListener('mousedown', initialize, true);
    function initialize() {
        new Synth().press(440);
        window.removeEventListener('touchstart', initialize, true);
        window.removeEventListener('mousedown', initialize, true);
    }

    const master = context.createGain();
    master.gain.value = 1.0;
    master.connect(context.destination);

    function Connect(params) {
        Object.keys(params).forEach((key) => {
            const [type, props, ...to] = params[key];
            this[key] = context[`create${type}`]();
            Object.keys(props).forEach((name) => {
                if (this[key][name]?.value !== undefined) {
                    this[key][name].value = props[name];
                } else {
                    this[key][name] = props[name];
                }
            });
        });

        Object.keys(params).forEach((key) => {
            const [type, props, ...to] = params[key];
            
            to.forEach((to) => {
                let dest = null;
                if (to.indexOf('.') > 0) {
                    dest = this[to.split('.')[0]][to.split('.')[1]];
                } else if (this[to]) {
                    dest = this[to];
                } else if (to === 'master') {
                    dest = master;
                }
                this[key].connect(dest);
            });
        });
    }

    class AudioFile {
        static store = new Map();
        constructor(path) {
            this.data = {};
            if (AudioFile.store.has(path)) {
                this.data = AudioFile.store.get(path);
            } else {
                this.data.buffer = null;
                this.data.promise = fetch(path)
                    .then((response) => response.arrayBuffer())
                    .then((response) => context.decodeAudioData(response))
                    .then((response) => this.data.buffer = response)
                    .catch(() => {
                        console.warn(`"${path}" could not be loaded.`)
                    });
                    AudioFile.store.set(path, this.data);
            }

            this.startTime = null;

            this.nodes = new Connect({
                source: ['BufferSource', {}, 'volume'],
                volume: ['Gain', { gain: 1.0 }, 'master'],
            });
        }
        isReady() {
            return this.data.buffer ? true : false;
        }
        get promise() {
            return this.data.promise;
        }
        set volume(value) {
            this.nodes.volume.gain.value = value;
        }
        get volume() {
            return this.nodes.volume.gain.value;
        }
        set loop(value) {
            this.nodes.source.loop = value;
        }
        get loop() {
            return this.nodes.source.loop;
        }
        play(offset = 0) {
            if (this.startTime !== null) return;
            if (this.isReady()) {
                this.startTime = context.currentTime;
                this.nodes.source.buffer = this.data.buffer;
                this.nodes.source.playbackRate.value = 1;
                this.nodes.source.start(context.currentTime, offset / 1000);
            } else {
                this.promise.then(() =>  this.play());
            }
        }
        stop() {
            if (this.startTime === null) return;
            this.nodes.source.stop(context.currentTime);
            this.startTime = null;
            return (context.currentTime - this.startTime) % this.data.buffer.duration * 1000;
        }
    };

    class Synth {
        constructor({ oscillator = null, filter = null, amp = null } = {}, { bmp = null, reverb = null, delay = null } = {}) {
            this.oscillator = isObject(oscillator) ? oscillator : {};
            this.oscillator.type = setType(this.oscillator.type, ['sine', 'triangle', 'square', 'sawtooth']);
            this.oscillator.envelope = setEnvelope(this.oscillator.envelope, -36, +36);
            this.oscillator.LFO = setLFO(this.oscillator.LFO, 36);

            this.filter = isObject(filter) ? filter : {};
            this.filter.type = setType(this.filter.type, ['lowpass', 'highpass', 'bandpass']);
            this.filter.Q = isNumber(this.filter.cotoff) ? clamp(this.filter.Q, 0, 32) : 0;
            this.filter.cotoff = isNumber(this.filter.cotoff) ? clamp(this.filter.cotoff, 4, 8192) : null;
            this.filter.envelope = setEnvelope(this.filter.envelope, -36, +36);
            this.filter.LFO = setLFO(this.filter.LFO, 36);

            this.amp = isObject(amp) ? amp : {};
            this.amp.envelope = setEnvelope(this.amp.envelope, 0, 1);
            this.amp.LFO = setLFO(this.amp.LFO, 36);

            this.bmp = isNumber(bmp) ? clamp(bmp, 60, 240) : 120;

            this.reverb = isObject(reverb) ? reverb : {};
            this.reverb.time = isNumber(this.reverb.time) ? clamp(this.reverb.time, 0, 2000) : 0.0;
            this.reverb.mix = isNumber(this.reverb.mix) ? clamp(this.reverb.mix, 0, 1.0) : 0.0;

            this.delay = isObject(delay) ? delay : {};
            this.delay.time = isNumber(this.delay.time) ? clamp(this.delay.time, 0, 2000) : 0.0;
            this.delay.feedback = isNumber(this.delay.feedback) ? clamp(this.delay.feedback, 0.0, 0.9) : 0.0;
            this.delay.mix = isNumber(this.delay.mix) ? clamp(this.delay.mix, 0.0, 1.0) : 0.0;

            function setType(type, list, value = 0) {
                return list.includes(type) ? type : list[value];
            }

            function setEnvelope(envelope, minAmount, maxAmount) {
                if (isObject(envelope) === false) return null;
                envelope.amount = isNumber(envelope.amount) ? clamp(envelope.amount, minAmount, maxAmount) : 0;
                envelope.ADSR = Array.isArray(envelope.ADSR) ? envelope.ADSR : [];
                envelope.ADSR[0] = isNumber(envelope.ADSR[0]) ? clamp(envelope.ADSR[0], 0, 8000) : 0;
                envelope.ADSR[1] = isNumber(envelope.ADSR[1]) ? clamp(envelope.ADSR[1], 0, 8000) : 0;
                envelope.ADSR[2] = isNumber(envelope.ADSR[2]) ? clamp(envelope.ADSR[2], 0, 1) : 0;
                envelope.ADSR[3] = isNumber(envelope.ADSR[3]) ? clamp(envelope.ADSR[3], 0, 8000) : 0;
                return envelope;
            }

            function setLFO(LFO, maxAmount) {
                if (isObject(LFO) === false) return null;
                LFO.amount = isNumber(LFO.amount) ? clamp(LFO.amount, 0, maxAmount): 0;
                LFO.type = setType(LFO.type, ['sine', 'triangle', 'square', 'sawtooth']);
                LFO.rate = clamp(LFO.rate, 1, 128);
                return LFO;
            }
        }
    
        static keymap = {
            'A0': 27.500, 'A#0': 29.135, 'B0': 30.868, 
            'C1': 32.703, 'C#1': 34.648, 'D1': 36.708, 'D#1': 38.891, 'E1': 41.203, 'F1': 43.654, 'F#1': 46.249, 'G1': 48.999, 'G#1': 51.913, 'A1': 55.000, 'A#1': 58.270, 'B1': 61.735, 
            'C2': 65.406, 'C#2': 69.296, 'D2': 73.416, 'D#2': 77.782, 'E2': 82.407, 'F2': 87.307, 'F#2': 92.499, 'G2': 97.999, 'G#2': 103.826, 'A2': 110.000, 'A#2': 116.541, 'B2': 123.471,
            'C3': 130.813, 'C#3': 138.591, 'D3': 146.832, 'D#3': 155.563, 'E3': 164.814, 'F3': 174.614, 'F#3': 184.997, 'G3': 195.998, 'G#3': 207.652, 'A3': 220.000, 'A#3': 233.082, 'B3': 246.942,
            'C4': 261.626, 'C#4': 277.183, 'D4': 293.665, 'D#4': 311.127, 'E4': 329.628, 'F4': 349.228, 'F#4': 369.994, 'G4': 391.995, 'G#4': 415.305, 'A4': 440.000, 'A#4': 466.164, 'B4': 493.883,
            'C5': 523.251, 'C#5': 554.365, 'D5': 587.330, 'D#5': 622.254, 'E5': 659.255, 'F5': 698.456, 'F#5': 739.989, 'G5': 783.991, 'G#5': 830.609, 'A5': 880.000, 'A#5': 932.328, 'B5': 987.767,
            'C6': 1046.502, 'C#6': 1108.731, 'D6': 1174.659, 'D#6': 1244.508, 'E6': 1318.510, 'F6': 1396.913, 'F#6': 1479.978, 'G6': 1567.982, 'G#6': 1661.219, 'A6': 1760.000, 'A#6': 1864.655, 'B6': 1975.533,
            'C7': 2093.005, 'C#7': 2217.461, 'D7': 2349.318, 'D#7': 2489.016, 'E7': 2637.020, 'F7': 2793.826, 'F#7': 2959.955, 'G7': 3135.963, 'G#7': 3322.438, 'A7': 3520.000, 'A#7': 3729.310, 'B7': 3951.066,
            'C8': 4186.009,
        };
    
        static notemap = {
            '1m': 4.000, '2n': 2.000, '4n': 1.000, '8n': 0.500, '16n': 0.250, '32n': 0.125,
        };
    
        press(frequency, duration = null, wait = 0.0) {
            frequency = isString(frequency) ? Synth.keymap[frequency] : frequency;

            duration = isString(duration) ? (Synth.notemap[duration] * 60 / this.options.bmp) : (duration !== null ? (duration / 1000) : duration);
            const start = context.currentTime + wait / 1000;
            let stop = null;
            
            const params = {};

            if (this.filter.type && this.filter.cutoff) {
                params.oscillator = ['Oscillator', {}, 'filter'];
                params.filter = ['BiquadFilter', {}, 'amp'];
            } else {
                params.oscillator = ['Oscillator', {}, 'amp'];
            }
            params.amp = ['Gain', { gain: 0.0 }, 'target'];
            params.target = ['Gain', { gain: 1.0 }, 'master'];

            if (this.reverb.time > 0.0 && this.reverb.mix > 0.0) {
                params.amp.push('convolver');
                params.convolver = ['Convolver', { buffer: impulseResponse({ time: this.reverb.time }) }, 'convolverDepth'];
                params.convolverDepth = ['Gain', { gain: 1.0 }, 'master'];
            }
            if (this.delay.time > 0.0 && this.delay.mix > 0.0) {
                params.amp.push('delay');
                params.delay = ['Delay', { }, 'delayDepth', 'delayFeedback'];
                params.delayDepth = ['Gain', { gain: 1.0 }, 'master'];
                params.delayFeedback = ['Gain', { gain: this.delay.feedback }, 'delay'];
            }

            if (this.oscillator.LFO) {
                params.oscillatorLFO = ['Oscillator', {}, 'oscillatorLFODepth'];
                params.oscillatorLFODepth = ['Gain', {}, 'oscillator.frequency'];
            }
            if (this.filter.LFO) {
                params.filterLFO = ['Oscillator', {}, 'filterLFODepth'];
                params.filterLFODepth = ['Gain', {}, 'filter.frequency'];
            }
            if (this.amp.LFO) {
                params.ampLFO = ['Oscillator', {}, 'ampLFODepth'];
                params.ampLFODepth = ['Gain', {}, 'amp.gain'];
            }

            const nodes = new Connect(params);
    
            nodes.oscillator.type = this.oscillator.type;
            nodes.oscillator.frequency.value = clamp(frequency, 10.0, 5000.0);
            
            if (this.filter.type && this.filter.cutoff) {
                nodes.filter.type = this.filter.type;
                nodes.filter.frequency.value = this.filter.cutoff;
            }
            if (this.reverb.time > 0.0 && this.reverb.mix > 0.0) {
                nodes.target.gain.value *= (1.0 - this.reverb.mix);
                nodes.convolverDepth.gain.value *= this.reverb.mix;
            }
            if (this.delay.time > 0.0 && this.delay.mix > 0.0) {
                console.log(this.delay.time / 1000);
                nodes.delay.delayTime.value = this.delay.time / 1000;
                nodes.target.gain.value *= (1.0 - this.delay.mix);
                nodes.delayDepth.gain.value *= this.delay.mix;
            }

            {
                if (this.oscillator.LFO) {
                    nodes.oscillatorLFODepth.gain.value = frequency * (Math.pow(2.0, this.oscillator.LFO.amount / 12.0) - 1.0);
                    nodes.oscillatorLFO.type = this.oscillator.LFO.type;
                    nodes.oscillatorLFO.frequency.value = this.oscillator.LFO.rate;
                    nodes.oscillatorLFO.start(start);
                }
                if (this.filter.LFO) {
                    nodes.filterLFODepth.gain.value = frequency * (Math.pow(2.0, this.filter.LFO.amount / 12.0) - 1.0);
                    nodes.filterLFO.type = this.filter.LFO.type;
                    nodes.filterLFO.frequency.value = this.filter.LFO.rate;
                    nodes.filterLFO.start(start);
                }
                if (this.amp.LFO) {
                    nodes.ampLFODepth.gain.value = this.amp.LFO.amount;
                    nodes.ampLFO.type = this.amp.LFO.type;
                    nodes.ampLFO.frequency.value = this.amp.LFO.rate;
                    nodes.ampLFO.start(start);
                }

                if (this.oscillator.envelope) {
                    const amount = frequency * (Math.pow(2.0, this.oscillator.envelope.amount / 12.0) - 1.0);
                    startEnvelope(nodes.oscillator.frequency, frequency, amount, this.oscillator.envelope.ADSR);
                }
                if (this.filter.envelope) {
                    const amount = this.filter.cutoff * (Math.pow(2.0, this.filter.envelope.amount / 12.0) - 1.0);
                    startEnvelope(nodes.filter.frequency, this.filter.cutoff, amount, this.filter.envelope.ADSR);
                }
                if (this.amp.envelope) {
                    startEnvelope(nodes.amp.gain, 0.0, this.amp.envelope.amount, this.amp.envelope.ADSR);
                }

                nodes.oscillator.start(start);
            }
            if (duration !== null) {
                release.call(this);
            }

            function release() {
                duration = duration ?? (context.currentTime - start);
                if (this.amp.envelope) {
                    const ADSR = this.amp.envelope.ADSR;
                    const adsr = [ADSR[0] / 1000, ADSR[1] / 1000, ADSR[2], ADSR[3] / 1000];
                    const rate = adsr[0] === 0.0 ? 1.0 : Math.min(duration / adsr[0], 1.0);
                    stop = start + Math.max((adsr[0] + adsr[1]) * rate, duration) + adsr[3];
                } else {
                    stop = start + duration;
                }

                if (this.oscillator.LFO) {
                    nodes.oscillatorLFO.stop(stop);
                }
                if (this.amp.LFO) {
                    nodes.ampLFO.stop(stop);
                }

                if (this.oscillator.envelope) {
                    const amount = frequency * (Math.pow(2.0, this.oscillator.envelope.amount / 12.0) - 1.0);
                    stopEnvelope(nodes.oscillator.frequency, frequency, amount, this.oscillator.envelope.ADSR);
                }
                if (this.filter.envelope) {
                    const amount = this.filter.cutoff * (Math.pow(2.0, this.filter.envelope.amount / 12.0) - 1.0);
                    stopEnvelope(nodes.filter.frequency, this.filter.cutoff, amount, this.filter.envelope.ADSR);
                }
                if (this.amp.envelope) {
                    stopEnvelope(nodes.amp.gain, 0.0, this.amp.envelope.amount, this.amp.envelope.ADSR);
                }

                nodes.oscillator.stop(stop);
            }

            function startEnvelope(param, base, amount, ADSR) {
                const adsr = [ADSR[0] / 1000, ADSR[1] / 1000, ADSR[2], ADSR[3] / 1000];
                param.value = base;
                param.setValueAtTime(base, start);
                param.linearRampToValueAtTime(base + amount, start + adsr[0]);
                param.linearRampToValueAtTime(base + amount * adsr[2], start + (adsr[0] + adsr[1]));
            }
            function stopEnvelope(param, base, amount, ADSR) {
                const adsr = [ADSR[0] / 1000, ADSR[1] / 1000, ADSR[2], ADSR[3] / 1000];
                const rate = adsr[0] === 0.0 ? 1.0 : Math.min(duration / adsr[0], 1.0);

                if (rate < 1.0) {
                    param.cancelScheduledValues(start);
                    param.setValueAtTime(base, start);
                    param.linearRampToValueAtTime(base + amount * rate, start + adsr[0] * rate);
                    param.linearRampToValueAtTime(base + amount * rate * adsr[2], start + (adsr[0] + adsr[1]) * rate);
                }
                param.linearRampToValueAtTime(base + amount * rate * adsr[2], start + Math.max((adsr[0] + adsr[1]) * rate, duration));
                param.linearRampToValueAtTime(base, start + Math.max((adsr[0] + adsr[1]) * rate, duration) + adsr[3]);
            }

            return {
                release: release.bind(this),
            }
        }
    }
    function impulseResponse({ time, decay = 2.0 }) {
        const length = context.sampleRate * time / 1000;
        const impulse = context.createBuffer(2, length, context.sampleRate);
    
        const ch0 = impulse.getChannelData(0);
        const ch1 = impulse.getChannelData(1);
        for (let i = 0; i < length; i++) {
            ch0[i] = (2 * Math.random() - 1) * Math.pow(1 - i / length, decay);
            ch1[i] = (2 * Math.random() - 1) * Math.pow(1 - i / length, decay);
        }
        return impulse;
    }
    
    return {
        get context() {
            return context;
        },
        create(props, effects) {
            return new Synth(props, effects);
        },
        load(path) {
            return new AudioFile(path);
        }
    };
})();