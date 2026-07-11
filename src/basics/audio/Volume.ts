//----------------------------------------------------------------------------------------------------
// Volume — master-gain accessor as a component
// The master GainNode is private to basics/audio; this component lets UI code read / write the
// global volume without touching it.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { master } from './bus';

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
