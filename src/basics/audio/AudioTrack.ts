//----------------------------------------------------------------------------------------------------
// AudioTrack — fetch + decode an audio file and drive it as a unit
// `startedAt` is the (virtual) context time of offset 0; pause freezes `currentTime - startedAt`
// into `pausedOffsetMs`, which `play()` resumes from unless given an explicit offset.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { context, master } from './master';

export function AudioTrack(unit: xnew.Unit, { url, volume, loop = false }: { url: string, volume?: number, loop?: boolean }) {
    let buffer: AudioBuffer | undefined;
    let source: AudioBufferSourceNode | null = null;
    let startedAt: number | null = null;
    let paused = false;
    let pausedOffsetMs = 0;
    let looping = loop;

    const amp = context.createGain();
    amp.gain.value = volume ?? 1.0;
    amp.connect(master);
    const fade = context.createGain();
    fade.gain.value = 1.0;
    fade.connect(amp);

    const promise = fetch(url)
        .then((response) => response.arrayBuffer())
        .then((response) => context.decodeAudioData(response))
        .then((response) => { buffer = response; });
    xnew.promise(promise);

    // Hard-stop the source without triggering its onended cleanup.
    function forceStop() {
        if (source !== null) {
            source.onended = null;
            try {
                source.stop();
            } catch {
                // Never started or already stopped — safe to ignore.
            }
            source.disconnect();
            source = null;
        }
        startedAt = null;
    }

    function startSource(offsetMs: number, fadeMs: number) {
        const node = context.createBufferSource();
        source = node;
        node.buffer = buffer!;
        node.loop = looping;
        node.connect(fade);

        const now = context.currentTime;
        startedAt = now - offsetMs / 1000;
        node.start(now, offsetMs / 1000);

        // Pin the fade gain: a prior fade-out may have left it at 0, silencing a fade=0 play.
        fade.gain.cancelScheduledValues(now);
        if (fadeMs > 0) {
            fade.gain.setValueAtTime(0, now);
            fade.gain.linearRampToValueAtTime(1.0, now + fadeMs / 1000);
        } else {
            fade.gain.setValueAtTime(1.0, now);
        }

        node.onended = () => {
            node.disconnect();
            // Clear state only if still the active source; pause / re-trigger null out `source` first
            // so a stale onended must not clobber pausedOffsetMs.
            if (source === node) {
                source = null;
                startedAt = null;
                pausedOffsetMs = 0;
            }
        };
    }

    function stopSource(node: AudioBufferSourceNode, fadeMs: number) {
        const now = context.currentTime;
        if (fadeMs > 0) {
            fade.gain.setValueAtTime(1.0, now);
            fade.gain.linearRampToValueAtTime(0, now + fadeMs / 1000);
            node.stop(now + fadeMs / 1000);
        } else {
            node.stop(now);
        }
    }

    // Release the Web Audio nodes when the unit is finalized.
    unit.on('finalize', () => {
        forceStop();
        amp.disconnect();
        fade.disconnect();
        pausedOffsetMs = 0;
    });

    return {
        // Play from `offset` (ms); if omitted, resume from the last pause (0 on a fresh track).
        // Called before decode finishes, it defers until the load resolves; called while playing, it
        // restarts at the offset.
        play: function play({ offset, fade: fadeMs = 0, loop: loopArg }: { offset?: number, fade?: number, loop?: boolean } = {}): void {
            if (buffer === undefined) {
                promise.then(() => play({ offset, fade: fadeMs, loop: loopArg }));
                return;
            }
            if (loopArg !== undefined) {
                looping = loopArg;
            }
            if (startedAt !== null) {
                forceStop();
            }
            paused = false;
            startSource(offset ?? pausedOffsetMs, fadeMs);
        },
        pause({ fade: fadeMs = 0 }: { fade?: number } = {}): void {
            if (buffer === undefined || startedAt === null) {
                return;
            }
            const elapsedSec = context.currentTime - startedAt;
            const positionSec = looping ? elapsedSec % buffer.duration : Math.min(elapsedSec, buffer.duration);
            paused = true;
            pausedOffsetMs = positionSec * 1000;

            // Detach before scheduling the stop, so its onended (guarded on `source === node`) skips
            // cleanup and pausedOffsetMs survives.
            const node = source!;
            source = null;
            startedAt = null;
            stopSource(node, fadeMs);
        },
        get status(): 'loading' | 'loaded' | 'playing' | 'paused' {
            if (buffer === undefined) {
                return 'loading';
            } else if (startedAt !== null) {
                return 'playing';
            } else if (paused) {
                return 'paused';
            } else {
                return 'loaded';
            }
        },
        get volume(): number {
            return amp.gain.value;
        },
        set volume(value: number) {
            amp.gain.value = value;
        },
    };
}
