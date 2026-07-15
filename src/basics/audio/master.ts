//----------------------------------------------------------------------------------------------------
// master — the package's single AudioContext + master GainNode, plus the Volume accessor component
// Created at import so every audio component mixes through one bus. In a context-less environment
// (Node/SSR/jsdom) context/master fall back to null so import never throws.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';

const DEFAULT_MASTER_GAIN = 0.1;

// Fall back to null where AudioContext is unavailable (Node/SSR/jsdom) so import never throws.
const AudioContextCtor: typeof AudioContext | undefined =
    typeof window !== 'undefined' ? (window.AudioContext ?? (window as any).webkitAudioContext) : undefined;
export const context: AudioContext = typeof AudioContextCtor === 'function' ? new AudioContextCtor() : null as unknown as AudioContext;
export const master: GainNode = context !== null ? context.createGain() : null as unknown as GainNode;

if (context !== null && master !== null) {
    master.gain.value = DEFAULT_MASTER_GAIN;
    master.connect(context.destination);
}

// Wake the context if the browser left it suspended (autoplay policy). Call from a sound entry point
// (press / play), which runs inside a user gesture; a no-op once running or where there is no context.
export function resume(): void {
    if (context !== null && context.state === 'suspended') {
        context.resume();
    }
}

//----------------------------------------------------------------------------------------------------
// Volume — master-gain accessor as a component, so UI code reads / writes global volume without the bus
//----------------------------------------------------------------------------------------------------

export function Volume(unit: xnew.Unit) {
    return {
        get volume(): number {
            return master.gain.value;
        },
        set volume(value: number) {
            master.gain.value = value;
        },
    };
}
