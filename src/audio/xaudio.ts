//----------------------------------------------------------------------------------------------------
// xaudio — audio layer facade: load audio files, create synthesizers, master volume
// load returns a plain AudioTrack and ties its release to a unit under the current scope, so sounds
// are disposed with the scene that created them; volume reads / writes the shared master gain.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../core/xnew';
import { master } from './master';
import { AudioTrack } from './AudioTrack';
import { Synthesizer, SynthesizerOptions } from './Synthesizer';

export const xaudio = {
    load(props: { url: string, volume?: number, loop?: boolean }): AudioTrack {
        const track = new AudioTrack(props);
        xnew((unit: xnew.Unit) => {
            xnew.promise(track.promise);
            unit.on('finalize', () => track.release());
        });
        return track;
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
