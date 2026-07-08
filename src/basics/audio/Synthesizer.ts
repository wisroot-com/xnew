//----------------------------------------------------------------------------------------------------
// Synthesizer — oscillator + amp / filter / reverb + ADSR + LFO synth, driven by press
//
// Each press builds a fresh node graph on the shared bus and schedules its envelopes up front, so
// notes overlap freely; nodes are stopped and disconnected after release.
//
// - Synthesizer        : component(SynthesizerOptions) returning { press }
// - SynthesizerOptions : { oscillator, amp, filter?, reverb?, bpm? }
//
// Usage: xnew(xbasics.Synthesizer, { oscillator: { type: 'sine' }, amp: { envelope: ... } }).press('A4', '4n');
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { context, master } from './bus';

const DEFAULT_BPM = 120;
const RELEASE_CLEANUP_DELAY_MS = 2000;

//----------------------------------------------------------------------------------------------------
// option types
//----------------------------------------------------------------------------------------------------

export type SynthesizerOptions = {
    oscillator: OscillatorOptions;
    amp: AmpOptions;
    filter?: FilterOptions;
    reverb?: ReverbOptions;
    bpm?: number; // 60 ~ 240
};

type OscillatorOptions = {
    type: OscillatorType; // sine, triangle, square, sawtooth
    envelope?: Envelope; // amount: -36 ~ +36
    LFO?: LFO; // amount: 0 ~ 36
};

type FilterOptions = {
    type: BiquadFilterType; // lowpass, highpass, bandpass
    cutoff: number; // 4 ~ 8192
};

type AmpOptions = {
    envelope: Envelope; // amount: 0 ~ 1
};

type ReverbOptions = {
    time: number; // 0 ~ 2000
    mix: number; // 0 ~ 1
};

type Envelope = {
    amount: number;
    ADSR: [number, number, number, number]; // A:0~8000, D:0~8000, S:0~1, R:0~8000
};

type LFO = {
    amount: number;
    type: OscillatorType;
    rate: number; // 1 ~ 128
};

//----------------------------------------------------------------------------------------------------
// note tables — frequency in Hz / note-length as a beat multiplier
//----------------------------------------------------------------------------------------------------

const keymap: { [key: string]: number } = {
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

const notemap: { [key: string]: number } = {
    '1m': 4.000, '2n': 2.000, '4n': 1.000, '8n': 0.500, '16n': 0.250, '32n': 0.125,
};

//----------------------------------------------------------------------------------------------------
// helpers
//----------------------------------------------------------------------------------------------------

function resolveFrequency(value: number | string): number {
    if (typeof value === 'string') {
        return keymap[value];
    } else {
        return value;
    }
}

function resolveDurationSeconds(value: number | string | undefined, bpm: number): number {
    if (typeof value === 'string') {
        return notemap[value] * 60 / bpm;
    } else if (typeof value === 'number') {
        return value / 1000;
    } else {
        return 0;
    }
}

// Frequency offset in Hz for a +amount semitone modulation of baseFreq.
function semitoneOffset(baseFreq: number, amount: number): number {
    return baseFreq * (Math.pow(2.0, amount / 12.0) - 1.0);
}

function scheduleAttackDecay(param: AudioParam, start: number, base: number, amount: number, ADSR: [number, number, number, number]): void {
    const [a, d, s] = ADSR;
    param.value = base;
    param.setValueAtTime(base, start);
    param.linearRampToValueAtTime(base + amount, start + a / 1000);
    param.linearRampToValueAtTime(base + amount * s, start + (a + d) / 1000);
}

// Returns the time the release ramp reaches `base`, so callers can stop the source there.
function scheduleRelease(param: AudioParam, start: number, dv: number, base: number, amount: number, ADSR: [number, number, number, number]): number {
    const [a, d, s, r] = ADSR;
    const end = dv > 0 ? dv : (context.currentTime - start);
    const rate = a === 0 ? 1.0 : Math.min(end / (a / 1000), 1.0);
    if (rate < 1.0) {
        param.cancelScheduledValues(start);
        param.setValueAtTime(base, start);
        param.linearRampToValueAtTime(base + amount * rate, start + (a / 1000) * rate);
        param.linearRampToValueAtTime(base + amount * rate * s, start + ((a + d) / 1000) * rate);
    }
    param.linearRampToValueAtTime(base + amount * rate * s, start + Math.max(((a + d) / 1000) * rate, dv));
    const stop = start + Math.max(((a + d) / 1000) * rate, end) + r / 1000;
    param.linearRampToValueAtTime(base, stop);
    return stop;
}

function createImpulseResponse(timeMs: number, decay = 2.0): AudioBuffer {
    const length = context.sampleRate * timeMs / 1000;
    const impulse = context.createBuffer(2, length, context.sampleRate);
    const ch0 = impulse.getChannelData(0);
    const ch1 = impulse.getChannelData(1);
    for (let i = 0; i < length; i++) {
        const k = Math.pow(1 - i / length, decay);
        ch0[i] = (2 * Math.random() - 1) * k;
        ch1[i] = (2 * Math.random() - 1) * k;
    }
    return impulse;
}

type LFOAttachment = { oscillator: OscillatorNode; depth: GainNode };

function attachLFO(target: OscillatorNode, baseFreq: number, lfo: LFO, start: number): LFOAttachment {
    const oscillator = context.createOscillator();
    const depth = context.createGain();
    depth.gain.value = semitoneOffset(baseFreq, lfo.amount);
    oscillator.type = lfo.type;
    oscillator.frequency.value = lfo.rate;
    oscillator.start(start);
    oscillator.connect(depth);
    depth.connect(target.frequency);
    return { oscillator, depth };
}

type ReverbAttachment = { convolver: ConvolverNode; depth: GainNode };

// Wet branch from `amp` to `master`. Also scales the dry-path `target` so wet+dry sums to ~1.
function attachReverb(amp: GainNode, target: GainNode, reverb: ReverbOptions): ReverbAttachment {
    const convolver = context.createConvolver();
    convolver.buffer = createImpulseResponse(reverb.time);
    const depth = context.createGain();
    depth.gain.value = reverb.mix;
    target.gain.value *= (1.0 - reverb.mix);

    amp.connect(convolver);
    convolver.connect(depth);
    depth.connect(master);
    return { convolver, depth };
}

//----------------------------------------------------------------------------------------------------
// component
//----------------------------------------------------------------------------------------------------

export function Synthesizer(unit: xnew.Unit, props: SynthesizerOptions) {
    // Press a note. `frequency`: Hz or note name ('A4'). `duration`: ms or note length ('4n') — with
    // one the note auto-releases, without one it sustains and returns { release }. `wait` (ms) delays
    // the attack.
    function press(frequency: number | string, duration?: number | string, wait?: number) {
        const freq = resolveFrequency(frequency);
        const dv = resolveDurationSeconds(duration, props.bpm ?? DEFAULT_BPM);
        const start = context.currentTime + (wait ?? 0) / 1000;

        // Sound source.
        const oscillator = context.createOscillator();
        oscillator.type = props.oscillator.type;
        oscillator.frequency.value = freq;

        const lfo = props.oscillator.LFO ? attachLFO(oscillator, freq, props.oscillator.LFO, start) : null;

        // amp → target → master, with optional wet path from amp.
        const amp = context.createGain();
        amp.gain.value = 0.0;
        const target = context.createGain();
        target.gain.value = 1.0;
        amp.connect(target);
        target.connect(master);

        // Optional filter inserted between oscillator and amp.
        let filter: BiquadFilterNode | null = null;
        if (props.filter) {
            filter = context.createBiquadFilter();
            filter.type = props.filter.type;
            filter.frequency.value = props.filter.cutoff;
            oscillator.connect(filter);
            filter.connect(amp);
        } else {
            oscillator.connect(amp);
        }

        const reverb = props.reverb ? attachReverb(amp, target, props.reverb) : null;

        // Schedule attack/decay phase.
        if (props.oscillator.envelope) {
            const amount = semitoneOffset(freq, props.oscillator.envelope.amount);
            scheduleAttackDecay(oscillator.frequency, start, freq, amount, props.oscillator.envelope.ADSR);
        }
        if (props.amp.envelope) {
            scheduleAttackDecay(amp.gain, start, 0.0, props.amp.envelope.amount, props.amp.envelope.ADSR);
        }

        oscillator.start(start);

        // Collect nodes to stop / disconnect when the note ends.
        const oscillators: OscillatorNode[] = [oscillator];
        const nodesToDisconnect: AudioNode[] = [oscillator, amp, target];
        if (lfo) {
            oscillators.push(lfo.oscillator);
            nodesToDisconnect.push(lfo.oscillator, lfo.depth);
        }
        if (filter) {
            nodesToDisconnect.push(filter);
        }
        if (reverb) {
            nodesToDisconnect.push(reverb.convolver, reverb.depth);
        }

        const release = () => {
            if (props.oscillator.envelope) {
                const amount = semitoneOffset(freq, props.oscillator.envelope.amount);
                scheduleRelease(oscillator.frequency, start, dv, freq, amount, props.oscillator.envelope.ADSR);
            }

            // Stop where the amp release ramp actually ends (no envelope: right at the note end).
            let stop: number;
            if (props.amp.envelope) {
                stop = scheduleRelease(amp.gain, start, dv, 0.0, props.amp.envelope.amount, props.amp.envelope.ADSR);
            } else {
                stop = start + (dv > 0 ? dv : (context.currentTime - start));
            }

            for (const o of oscillators) {
                o.stop(stop);
            }

            setTimeout(() => {
                for (const n of nodesToDisconnect) {
                    n.disconnect();
                }
            }, RELEASE_CLEANUP_DELAY_MS);
        };

        if (dv > 0) {
            release();
        } else {
            return { release };
        }
    }

    return { press };
}
