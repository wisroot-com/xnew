//----------------------------------------------------------------------------------------------------
// time — runtime-agnostic tickers and timers (rAF in the browser / setTimeout in Node)
//
// - Ticker : calls back at the target FPS (passes delta = ms elapsed since the previous frame)
// - Timer  : setTimeout timer with easing; auto-pauses on visibilitychange (browser only)
//----------------------------------------------------------------------------------------------------

//----------------------------------------------------------------------------------------------------
// ticker
//----------------------------------------------------------------------------------------------------

export class Ticker {
    private cancel: (() => void) | null = null;

    constructor(callback: Function, fps: number = 60) {
        const interval = 1000 / fps;

        if (typeof requestAnimationFrame !== 'undefined') {
            // rAF fires at the display refresh rate, so throttle down to the target fps.
            // The first frame is scheduled (not run synchronously), so the callback begins next frame.
            const minDelta = interval * 0.9;
            let previous = Date.now();
            const tick = (): void => {
                const now = Date.now();
                const delta = now - previous;
                if (delta > minDelta) {
                    callback(delta); // pass elapsed ms to the callback (becomes the update / render delta)
                    previous = now;
                }
                id = requestAnimationFrame(tick);
            };
            let id = requestAnimationFrame(tick);
            this.cancel = () => cancelAnimationFrame(id);
        } else {
            // setTimeout already fires at the target interval, so no throttling is needed.
            let id: ReturnType<typeof setTimeout>;
            const tick = (): void => {
                callback(interval);
                id = setTimeout(tick, interval);
            };
            tick();
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
    private id: number | null = null;
    private time: { start: number, processed: number } = { start: 0.0, processed: 0.0 };
    private request: boolean = true;
    private visibilityListener: () => void;
    private ticker: Ticker;

    constructor(
        private timeout: Function | null,
        private transition: Function | null,
        private duration: number,
        private easing?: string,
    ) {
        this.ticker = new Ticker(() => this.animation());

        this.visibilityListener = () => document.hidden === false ? this._start() : this._stop();
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', this.visibilityListener);
        }

        this.transition?.(0.0);
        this.start();
    }

    private animation(): void {
        const p = Math.min(this.elapsed() / this.duration, 1.0);
        this.transition?.(ease(p, this.easing));
    }

    public clear(): void {
        if (this.id !== null) {
            clearTimeout(this.id);
            this.id = null;
        }
        if (typeof document !== 'undefined') {
            document.removeEventListener('visibilitychange', this.visibilityListener);
        }
        this.ticker.clear();
    }

    public elapsed(): number {
        return this.time.processed + (this.id !== null ? (Date.now() - this.time.start) : 0);
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
        if (this.request === true && this.id === null) {
            this.id = setTimeout(() => {
                this.id = null;
                this.time = { start: 0.0, processed: 0.0 };

                this.transition?.(1.0);
                this.timeout?.();

                this.clear();
            }, this.duration - this.time.processed) as unknown as number;
            this.time.start = Date.now();
        }
    }

    private _stop(): void {
        if (this.request === true && this.id !== null) {
            this.time.processed = this.time.processed + Date.now() - this.time.start;
            clearTimeout(this.id);
            this.id = null;
        }
    }
}

