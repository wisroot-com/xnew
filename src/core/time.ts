//----------------------------------------------------------------------------------------------------
// time — runtime-agnostic tickers and timers (rAF in the browser / setTimeout in Node)
//
// - Ticker : calls back at the target FPS (passes delta = measured ms since the previous call)
// - Timer  : setTimeout timer with easing; auto-pauses on visibilitychange (browser only)
//----------------------------------------------------------------------------------------------------

//----------------------------------------------------------------------------------------------------
// ticker
//----------------------------------------------------------------------------------------------------

export class Ticker {
    private cancel: (() => void) | null = null;

    constructor(callback: Function, fps: number = 60) {
        const interval = 1000 / fps;
        // absolute schedule (next += interval): the fractional remainder carries over, so the
        // average rate holds the target fps even when the frame rate is not a multiple of it
        let previous = Date.now();
        let next = previous + interval;

        if (typeof requestAnimationFrame !== 'undefined') {
            const tolerance = interval * 0.1; // rAF frames can land slightly early
            const tick = (): void => {
                const now = Date.now();
                if (now >= next - tolerance) {
                    callback(now - previous);
                    previous = now;
                    next += interval;
                    if (next < now) {
                        next = now + interval; // resync after a stall (e.g. hidden tab)
                    }
                }
                id = requestAnimationFrame(tick);
            };
            let id = requestAnimationFrame(tick);
            this.cancel = () => cancelAnimationFrame(id);
        } else {
            let id: ReturnType<typeof setTimeout>;
            const tick = (): void => {
                const now = Date.now();
                callback(now - previous);
                previous = now;
                next += interval;
                if (next < now) {
                    next = now + interval;
                }
                id = setTimeout(tick, next - now);
            };
            id = setTimeout(tick, interval);
            this.cancel = () => clearTimeout(id);
        }
    }

    clear(): void {
        if (this.cancel !== null) {
            this.cancel();
            this.cancel = null;
        }
    }
}

//----------------------------------------------------------------------------------------------------
// timer
//----------------------------------------------------------------------------------------------------

/**
 * Maps a linear progress value in [0, 1] to an eased value, anchored at 0 and 1.
 */
function ease(p: number, easing?: string): number {
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

export class Timer {
    private id: ReturnType<typeof setTimeout> | null = null;
    private startTime: number = 0.0;
    private processed: number = 0.0;
    private request: boolean = true;
    private cleared: boolean = false;
    private visibilityListener: () => void;
    private ticker: Ticker | null = null;

    constructor(
        private timeout: Function | null,
        private transition: Function | null,
        private duration: number,
        private easing?: string,
    ) {
        this.visibilityListener = () => document.hidden === false ? this._start() : this._stop();
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', this.visibilityListener);
        }

        this.transition?.(0.0);
        this._start();
    }

    private animation(): void {
        const p = this.duration > 0.0 ? Math.min(this.elapsed() / this.duration, 1.0) : 1.0;
        this.transition?.(ease(p, this.easing));
    }

    public clear(): void {
        this.cleared = true;
        if (this.id !== null) {
            clearTimeout(this.id);
            this.id = null;
        }
        if (typeof document !== 'undefined') {
            document.removeEventListener('visibilitychange', this.visibilityListener);
        }
        this.ticker?.clear();
        this.ticker = null;
    }

    public elapsed(): number {
        return this.processed + (this.id !== null ? (Date.now() - this.startTime) : 0.0);
    }

    public start(): void {
        this.request = true;
        this._start();
    }

    public stop(): void {
        this._stop();
        this.request = false;
    }

    private _start(): void {
        if (this.cleared === false && this.request === true && this.id === null) {
            this.id = setTimeout(() => {
                this.id = null;
                this.clear(); // clean up first so a throwing callback cannot leak the ticker / listener
                this.transition?.(1.0);
                this.timeout?.();
            }, this.duration - this.processed);
            this.startTime = Date.now();
            if (this.transition !== null) {
                this.ticker = new Ticker(() => this.animation());
            }
        }
    }

    private _stop(): void {
        if (this.id !== null) {
            this.processed += Date.now() - this.startTime;
            clearTimeout(this.id);
            this.id = null;
            this.ticker?.clear();
            this.ticker = null;
        }
    }
}

