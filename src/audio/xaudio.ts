//----------------------------------------------------------------------------------------------------
// xaudio — audio layer facade: load audio files, create synthesizers, master volume
// load / synthesizer mount an AudioTrack / Synthesizer unit under the current scope, so sounds are
// disposed with the scene that created them; volume reads / writes the shared master gain directly.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../core/xnew';
import { master } from './master';
import { AudioTrack } from './AudioTrack';
import { Synthesizer, SynthesizerOptions } from './Synthesizer';

export const xaudio = {
    load(props: { url: string, volume?: number, loop?: boolean }) {
        return xnew(AudioTrack, props);
    },
    synthesizer(props: SynthesizerOptions) {
        return xnew(Synthesizer, props);
    },
    get volume(): number {
        return master.gain.value;
    },
    set volume(value: number) {
        master.gain.value = value;
    },
};
