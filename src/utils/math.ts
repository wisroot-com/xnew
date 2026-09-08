//----------------------------------------------------------------------------------------------------
// math — small numeric helpers shared across components
// Domain-free by definition: plain numbers in, plain numbers out — no colors, DOM, audio, or clocks.
//----------------------------------------------------------------------------------------------------

// Confines value to [low, high].
export function clamp(value: number, low: number, high: number): number {
    return Math.min(Math.max(value, low), high);
}

// Maps a linear progress value in [0, 1] to an eased value, anchored at 0 and 1.
export function ease(p: number, easing?: string): number {
    switch (easing) {
        case 'ease-out':
            return Math.pow(1.0 - Math.pow(1.0 - p, 2.0), 0.5);
        case 'ease-in':
            return Math.pow(1.0 - Math.pow(1.0 - p, 0.5), 2.0);
        case 'ease':
            return ((s) => s * s * (3 - 2 * s))(p ** 0.7);
        case 'ease-in-out':
            return p * p * (3 - 2 * p);
        default:
            return p;
    }
}
