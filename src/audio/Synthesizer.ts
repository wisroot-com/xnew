//----------------------------------------------------------------------------------------------------
// Synthesizer — oscillator + amp / filter / reverb + ADSR + LFO synth; a plain class, no xnew dependency
// Each press builds a fresh node graph on the shared bus and schedules its envelopes up front, so
// notes overlap freely; nodes are stopped and disconnected after release.
//----------------------------------------------------------------------------------------------------

import { context, master, resume } from './master';

const DEFAULT_BPM = 120;
const RELEASE_CLEANUP_DELAY_MS = 2000;

//----------------------------------------------------------------------------------------------------
// option types
//----------------------------------------------------------------------------------------------------

export type SynthesizerOptions = {
    oscillator: {
        type: OscillatorType;                                         // sine, triangle, square, sawtooth
        envelope?: Envelope;                                          // amount: -36 ~ +36
        LFO?: { amount: number; type: OscillatorType; rate: number }; // amount: 0 ~ 36, rate: 1 ~ 128
    };
    amp: { envelope: Envelope };                                      // amount: 0 ~ 1
    filter?: { type: BiquadFilterType; cutoff: number };              // lowpass / highpass / bandpass, cutoff: 4 ~ 8192
    reverb?: { time: number; mix: number };                           // time: 0 ~ 2000ms, mix: 0 ~ 1
    bpm?: number;                                                     // 60 ~ 240
};

type Envelope = {
    amount: number;
    ADSR: [number, number, number, number]; // A: 0 ~ 8000ms, D: 0 ~ 8000ms, S: 0 ~ 1, R: 0 ~ 8000ms
};

//----------------------------------------------------------------------------------------------------
// note resolution — note name to equal-temperament Hz / note length to a beat multiplier
//----------------------------------------------------------------------------------------------------

const NOTE_INDEX: { [key: string]: number } = { 'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11 };

const notemap: { [key: string]: number } = {
    '1m': 4.000, '2n': 2.000, '4n': 1.000, '8n': 0.500, '16n': 0.250, '32n': 0.125,
};

function resolveFrequency(value: number | string): number {
    if (typeof value === 'string') {
        // equal temperament anchored at A4 (semitone index 57) = 440Hz
        const semitone = NOTE_INDEX[value.slice(0, -1)] + Number(value.slice(-1)) * 12;
        return 440 * Math.pow(2, (semitone - 57) / 12);
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

//----------------------------------------------------------------------------------------------------
// helpers
//----------------------------------------------------------------------------------------------------

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

function attachLFO(target: OscillatorNode, baseFreq: number, lfo: { amount: number; type: OscillatorType; rate: number }, start: number): { oscillator: OscillatorNode; depth: GainNode } {
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

// Wet branch from `amp` to `master`. Also scales the dry-path `target` so wet+dry sums to ~1.
function attachReverb(amp: GainNode, target: GainNode, reverb: { time: number; mix: number }): { convolver: ConvolverNode; depth: GainNode } {
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
// Synthesizer class
//----------------------------------------------------------------------------------------------------

type Note = {
    stopped: boolean;
    cleanupTimer: ReturnType<typeof setTimeout> | null;
    stopAll: () => void;
    cleanup: () => void;
};

export class Synthesizer {
    private readonly props: SynthesizerOptions;

    // Notes still sounding or in their release tail; clear() stops + disconnects any left over
    // (a sustained note whose release was never called would otherwise play on after teardown).
    private readonly active = new Set<Note>();

    constructor(props: SynthesizerOptions) {
        this.props = props;
    }

    // Press a note. `frequency`: Hz or note name ('A4'). `duration`: ms or note length ('4n') — with
    // one the note auto-releases, without one it sustains and returns { release }. `wait` (ms) delays
    // the attack.
    press(frequency: number | string, duration?: number | string, wait?: number): { release: () => void } | undefined {
        resume();   // wake a suspended context (autoplay policy); no-op once running
        const props = this.props;
        const freq = resolveFrequency(frequency);
        const dv = resolveDurationSeconds(duration, props.bpm ?? DEFAULT_BPM);
        const start = context.currentTime + (wait ?? 0) / 1000;

        // Nodes to stop / disconnect when the note ends, filled as the graph is built.
        const oscillators: OscillatorNode[] = [];
        const nodesToDisconnect: AudioNode[] = [];

        // Sound source.
        const oscillator = context.createOscillator();
        oscillator.type = props.oscillator.type;
        oscillator.frequency.value = freq;
        oscillators.push(oscillator);

        if (props.oscillator.LFO) {
            const lfo = attachLFO(oscillator, freq, props.oscillator.LFO, start);
            oscillators.push(lfo.oscillator);
            nodesToDisconnect.push(lfo.oscillator, lfo.depth);
        }

        // amp → target → master, with optional wet path from amp.
        const amp = context.createGain();
        amp.gain.value = 0.0;
        const target = context.createGain();
        target.gain.value = 1.0;
        amp.connect(target);
        target.connect(master);
        nodesToDisconnect.push(oscillator, amp, target);

        // Optional filter inserted between oscillator and amp.
        if (props.filter) {
            const filter = context.createBiquadFilter();
            filter.type = props.filter.type;
            filter.frequency.value = props.filter.cutoff;
            oscillator.connect(filter);
            filter.connect(amp);
            nodesToDisconnect.push(filter);
        } else {
            oscillator.connect(amp);
        }

        if (props.reverb) {
            const reverb = attachReverb(amp, target, props.reverb);
            nodesToDisconnect.push(reverb.convolver, reverb.depth);
        }

        // Schedule attack/decay phase.
        if (props.oscillator.envelope) {
            const amount = semitoneOffset(freq, props.oscillator.envelope.amount);
            scheduleAttackDecay(oscillator.frequency, start, freq, amount, props.oscillator.envelope.ADSR);
        }
        if (props.amp.envelope) {
            scheduleAttackDecay(amp.gain, start, 0.0, props.amp.envelope.amount, props.amp.envelope.ADSR);
        }

        oscillator.start(start);

        const note: Note = {
            stopped: false,
            cleanupTimer: null,
            stopAll: () => {
                for (const o of oscillators) {
                    o.stop();
                }
            },
            cleanup: () => {
                this.active.delete(note);
                for (const n of nodesToDisconnect) {
                    n.disconnect();
                }
            },
        };
        this.active.add(note);

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
            note.stopped = true;

            // The pending disconnect is cancelled by clear(), which then handles the nodes itself.
            note.cleanupTimer = setTimeout(note.cleanup, RELEASE_CLEANUP_DELAY_MS);
        };

        if (dv > 0) {
            release();
            return undefined;
        } else {
            return { release };
        }
    }

    // Stop every active note and release the Web Audio nodes; the synthesizer stays usable.
    clear(): void {
        for (const note of this.active) {
            if (note.cleanupTimer !== null) {
                clearTimeout(note.cleanupTimer);
            }
            if (note.stopped === false) {
                note.stopAll();
            }
            note.cleanup();   // also removes the note from `active`
        }
    }
}
