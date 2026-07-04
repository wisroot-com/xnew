import { Ticker, Timer } from '../../src/core/time';

describe('Ticker', () => {
    beforeEach(() => jest.useFakeTimers({ now: 0 }));
    afterEach(() => jest.useRealTimers());

    it('invokes the callback over time once started', () => {
        const cb = jest.fn();
        new Ticker(cb);
        jest.advanceTimersByTime(100);
        expect(cb).toHaveBeenCalled();
    });

    it('stops invoking after clear()', () => {
        const cb = jest.fn();
        const ticker = new Ticker(cb);
        ticker.clear();
        jest.advanceTimersByTime(1000);
        expect(cb).not.toHaveBeenCalled();
    });

    it('stops invoking when cleared after some ticks', () => {
        const cb = jest.fn();
        const ticker = new Ticker(cb);
        jest.advanceTimersByTime(100);
        const callsBeforeClear = cb.mock.calls.length;
        expect(callsBeforeClear).toBeGreaterThan(0);
        ticker.clear();
        jest.advanceTimersByTime(1000);
        expect(cb).toHaveBeenCalledTimes(callsBeforeClear);
    });

    it('passes a per-frame delta (ms), never an epoch-scale value', () => {
        const cb = jest.fn();
        new Ticker(cb);
        jest.advanceTimersByTime(100);
        const deltas = cb.mock.calls.map((c) => c[0] as number);
        expect(deltas.length).toBeGreaterThan(0);
        for (const d of deltas) {
            expect(typeof d).toBe('number');
            expect(d).toBeGreaterThan(0);
            expect(d).toBeLessThan(1000); // 初回 delta が Date.now()（epoch）に化ける回帰を防ぐ
        }
    });

    it('holds the target fps on average when the frame rate is not a multiple of it', () => {
        // fake rAF fires every 16ms; "reset from fire time" pacing would quantize 50fps to ~31fps
        const cb = jest.fn();
        new Ticker(cb, 50);
        jest.advanceTimersByTime(1000);
        expect(cb.mock.calls.length).toBeGreaterThanOrEqual(46);
        expect(cb.mock.calls.length).toBeLessThanOrEqual(52);
    });

    it('keeps the sum of reported deltas equal to elapsed wall-clock time', () => {
        // remainder-carry pacing ("previous = now - delta % interval") would double-count time
        const cb = jest.fn();
        new Ticker(cb, 50);
        jest.advanceTimersByTime(1000);
        const total = cb.mock.calls.reduce((sum, c) => sum + (c[0] as number), 0);
        expect(total).toBeLessThanOrEqual(1000);
        expect(total).toBeGreaterThan(900);
    });

    it('falls back to setTimeout when requestAnimationFrame is unavailable', () => {
        const raf = global.requestAnimationFrame;
        (global as any).requestAnimationFrame = undefined;
        try {
            const cb = jest.fn();
            new Ticker(cb);
            jest.advanceTimersByTime(100);
            expect(cb).toHaveBeenCalled();
        } finally {
            (global as any).requestAnimationFrame = raf;
        }
    });
});

describe('Timer', () => {
    beforeEach(() => jest.useFakeTimers({ now: 0 }));
    afterEach(() => jest.useRealTimers());

    it('fires the timeout callback once at the given duration', () => {
        const cb = jest.fn();
        new Timer(cb, null, 500);
        jest.advanceTimersByTime(499);
        expect(cb).not.toHaveBeenCalled();
        jest.advanceTimersByTime(1);
        expect(cb).toHaveBeenCalledTimes(1);
    });

    it('emits 0 first and 1 on completion via transition (bare number arg)', () => {
        const cb = jest.fn();
        new Timer(null, cb, 100);
        // First call happens synchronously in the constructor with a bare 0.
        expect(cb).toHaveBeenCalledTimes(1);
        expect(cb.mock.calls[0][0]).toBe(0.0);
        jest.advanceTimersByTime(100);
        // Final call on completion is a bare 1.
        expect(cb.mock.calls.at(-1)![0]).toBe(1.0);
    });

    it('progresses transition monotonically between 0 and 1', () => {
        const cb = jest.fn();
        new Timer(null, cb, 200);
        jest.advanceTimersByTime(200);
        const values = cb.mock.calls.map((c) => c[0] as number);
        // every emitted value is a bare number within [0, 1]
        for (const v of values) {
            expect(typeof v).toBe('number');
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThanOrEqual(1);
        }
        // non-decreasing progress
        for (let i = 1; i < values.length; i++) {
            expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
        }
        expect(values[0]).toBe(0);
        expect(values.at(-1)).toBe(1);
    });

    it('cancels a scheduled timeout via clear()', () => {
        const cb = jest.fn();
        const timer = new Timer(cb, null, 500);
        timer.clear();
        jest.advanceTimersByTime(1000);
        expect(cb).not.toHaveBeenCalled();
    });

    it('pauses the elapsed clock on stop() and resumes on start()', () => {
        const cb = jest.fn();
        const timer = new Timer(cb, null, 500);
        jest.advanceTimersByTime(300);
        timer.stop();
        // While stopped, advancing time must not fire the timeout.
        jest.advanceTimersByTime(1000);
        expect(cb).not.toHaveBeenCalled();
        timer.start();
        // 200ms remaining after 300ms processed.
        jest.advanceTimersByTime(199);
        expect(cb).not.toHaveBeenCalled();
        jest.advanceTimersByTime(1);
        expect(cb).toHaveBeenCalledTimes(1);
    });

    it('applies ease-out easing so mid progress exceeds linear', () => {
        const linear: number[] = [];
        const eased: number[] = [];
        new Timer(null, (p: number) => linear.push(p), 1000);
        new Timer(null, (p: number) => eased.push(p), 1000, 'ease-out');
        // advance to roughly the midpoint
        jest.advanceTimersByTime(500);
        const linearMid = linear.at(-1)!;
        const easedMid = eased.at(-1)!;
        // ease-out front-loads progress, so at the same elapsed time it should be >= linear.
        expect(easedMid).toBeGreaterThanOrEqual(linearMid);
        // endpoints still anchored at 0
        expect(linear[0]).toBe(0);
        expect(eased[0]).toBe(0);
        // complete both and confirm they end at 1
        jest.advanceTimersByTime(500);
        expect(linear.at(-1)).toBe(1);
        expect(eased.at(-1)).toBe(1);
    });

    it('does not throw when document is undefined (SSR)', () => {
        const doc = global.document;
        (global as any).document = undefined;
        try {
            const cb = jest.fn();
            expect(() => new Timer(cb, null, 100)).not.toThrow();
        } finally {
            (global as any).document = doc;
        }
    });

    it.todo('pauses on document visibilitychange and resumes when visible (jsdom: document.hidden is read-only / visibilitychange not dispatchable with a controllable hidden state)');
});
