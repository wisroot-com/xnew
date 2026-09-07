//----------------------------------------------------------------------------------------------------
// side — which side of the wire xsync runs on (auto-detected from the runtime; setSide overrides for tests)
//----------------------------------------------------------------------------------------------------

export type Side = 'server' | 'client';

let side: Side | null = null;

export function setSide(value: Side | null): void {
    side = value;
}

export function getSide(): Side {
    return side ?? ((typeof window === 'undefined' || typeof window.document === 'undefined') ? 'server' : 'client');
}
