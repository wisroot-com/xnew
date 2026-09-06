//----------------------------------------------------------------------------------------------------
// master — the package's single AudioContext + master GainNode
// Created at import so every audio component mixes through one bus. In a context-less environment
// (Node/SSR/jsdom) context/master fall back to null so import never throws.
//----------------------------------------------------------------------------------------------------

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

// Wake a suspended context (autoplay policy) from a sound entry point's user gesture; a no-op once running or without a context.
export function resume(): void {
    if (context !== null && context.state === 'suspended') {
        context.resume();
    }
}
