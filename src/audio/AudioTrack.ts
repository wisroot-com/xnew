//----------------------------------------------------------------------------------------------------
// AudioTrack — fetch + decode an audio file and play it; a plain class with no xnew dependency
// `startedAt` is the (virtual) context time of offset 0; pause freezes `currentTime - startedAt`
// into `pausedOffsetMs`, which `play()` resumes from unless given an explicit offset.
//----------------------------------------------------------------------------------------------------

import { context, master, resume } from './master';

export class AudioTrack {
    // Resolves when the file is fetched and decoded; play() before then defers itself onto this.
    readonly promise: Promise<void>;

    private buffer: AudioBuffer | undefined;
    private source: AudioBufferSourceNode | null = null;
    private startedAt: number | null = null;
    private paused = false;
    private pausedOffsetMs = 0;
    private looping: boolean;
    private readonly amp: GainNode;
    private readonly fade: GainNode;

    constructor({ url, volume, loop = false }: { url: string, volume?: number, loop?: boolean }) {
        this.looping = loop;

        this.amp = context.createGain();
        this.amp.gain.value = volume ?? 1.0;
        this.amp.connect(master);
        this.fade = context.createGain();
        this.fade.gain.value = 1.0;
        this.fade.connect(this.amp);

        this.promise = fetch(url)
            .then((response) => response.arrayBuffer())
            .then((response) => context.decodeAudioData(response))
            .then((response) => { this.buffer = response; });
    }

    // Play from `offset` (ms); if omitted, resume from the last pause (0 on a fresh track).
    // Called before decode finishes, it defers until the load resolves; called while playing, it
    // restarts at the offset.
    play({ offset, fade: fadeMs = 0, loop: loopArg }: { offset?: number, fade?: number, loop?: boolean } = {}): void {
        resume();   // wake a suspended context (autoplay policy); no-op once running
        if (this.buffer === undefined) {
            this.promise.then(() => this.play({ offset, fade: fadeMs, loop: loopArg }));
        } else {
            if (loopArg !== undefined) {
                this.looping = loopArg;
            }
            if (this.startedAt !== null) {
                this.forceStop();
            }
            this.paused = false;
            this.startSource(offset ?? this.pausedOffsetMs, fadeMs);
        }
    }

    pause({ fade: fadeMs = 0 }: { fade?: number } = {}): void {
        if (this.buffer === undefined || this.startedAt === null) {
            // Nothing playing (still loading, stopped, or already paused) — keep the current state.
        } else {
            const elapsedSec = context.currentTime - this.startedAt;
            const positionSec = this.looping ? elapsedSec % this.buffer.duration : Math.min(elapsedSec, this.buffer.duration);
            this.paused = true;
            this.pausedOffsetMs = positionSec * 1000;

            // Detach before scheduling the stop, so its onended (guarded on `source === node`) skips
            // cleanup and pausedOffsetMs survives.
            const node = this.source!;
            this.source = null;
            this.startedAt = null;
            this.stopSource(node, fadeMs);
        }
    }

    get status(): 'loading' | 'loaded' | 'playing' | 'paused' {
        if (this.buffer === undefined) {
            return 'loading';
        } else if (this.startedAt !== null) {
            return 'playing';
        } else if (this.paused) {
            return 'paused';
        } else {
            return 'loaded';
        }
    }

    get volume(): number {
        return this.amp.gain.value;
    }

    set volume(value: number) {
        this.amp.gain.value = value;
    }

    // Release the Web Audio nodes; the track is unusable afterwards.
    release(): void {
        this.forceStop();
        this.amp.disconnect();
        this.fade.disconnect();
        this.pausedOffsetMs = 0;
    }

    // Hard-stop the source without triggering its onended cleanup.
    private forceStop(): void {
        if (this.source !== null) {
            this.source.onended = null;
            try {
                this.source.stop();
            } catch {
                // Never started or already stopped — safe to ignore.
            }
            this.source.disconnect();
            this.source = null;
        }
        this.startedAt = null;
    }

    private startSource(offsetMs: number, fadeMs: number): void {
        const node = context.createBufferSource();
        this.source = node;
        node.buffer = this.buffer!;
        node.loop = this.looping;
        node.connect(this.fade);

        const now = context.currentTime;
        this.startedAt = now - offsetMs / 1000;
        node.start(now, offsetMs / 1000);

        // Pin the fade gain: a prior fade-out may have left it at 0, silencing a fade=0 play.
        this.fade.gain.cancelScheduledValues(now);
        if (fadeMs > 0) {
            this.fade.gain.setValueAtTime(0, now);
            this.fade.gain.linearRampToValueAtTime(1.0, now + fadeMs / 1000);
        } else {
            this.fade.gain.setValueAtTime(1.0, now);
        }

        node.onended = () => {
            node.disconnect();
            // Clear state only if still the active source; pause / re-trigger null out `source` first
            // so a stale onended must not clobber pausedOffsetMs.
            if (this.source === node) {
                this.source = null;
                this.startedAt = null;
                this.pausedOffsetMs = 0;
            }
        };
    }

    private stopSource(node: AudioBufferSourceNode, fadeMs: number): void {
        const now = context.currentTime;
        if (fadeMs > 0) {
            this.fade.gain.setValueAtTime(1.0, now);
            this.fade.gain.linearRampToValueAtTime(0, now + fadeMs / 1000);
            node.stop(now + fadeMs / 1000);
        } else {
            node.stop(now);
        }
    }
}
