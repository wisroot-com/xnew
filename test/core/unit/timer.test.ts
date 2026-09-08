import { Unit, UnitTimer } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';

describe('UnitTimer', () => {
    beforeEach(() => {
        jest.useFakeTimers({ now: 0 });
        Unit.reset();
    });
    afterEach(() => {
        Unit.engineRoot?.destroy();
        jest.useRealTimers();
    });

    describe('scope', () => {
        it('runs the timeout callback in the originating unit scope', () => {
            const observed: Array<Unit | null> = [];
            let target!: Unit;
            xnew((unit: Unit) => {
                target = unit;
                xnew.timeout(() => observed.push(Unit.currentUnit), 10);
            });

            jest.advanceTimersByTime(10);

            expect(observed).toEqual([target]);
        });

        it('runs the transition callback in the originating unit scope', () => {
            const observed: Array<Unit | null> = [];
            let target!: Unit;
            xnew((unit: Unit) => {
                target = unit;
                xnew.transition(() => observed.push(Unit.currentUnit), 100);
            });

            jest.advanceTimersByTime(100);

            expect(observed.length).toBeGreaterThan(0);
            expect(observed.every((u) => u === target)).toBe(true);
        });

        it('returns a UnitTimer instance from xnew.timeout', () => {
            let timer: unknown;
            xnew(() => {
                timer = xnew.timeout(() => {}, 10);
            });
            expect(timer).toBeInstanceOf(UnitTimer);
        });
    });

    describe('clear', () => {
        it('clear() cancels a pending timer', () => {
            const cb = jest.fn();
            xnew(() => {
                const timer = xnew.timeout(cb, 1000);
                timer.clear();
            });

            jest.advanceTimersByTime(5000);

            expect(cb).not.toHaveBeenCalled();
        });

        it('clear() drops queued timers as well', () => {
            const first = jest.fn();
            const second = jest.fn();
            let timer!: UnitTimer;
            xnew(() => {
                timer = xnew.timeout(first, 100);
                timer.timeout(second, 100);
            });

            timer.clear();
            jest.advanceTimersByTime(5000);

            expect(first).not.toHaveBeenCalled();
            expect(second).not.toHaveBeenCalled();
        });
    });

    describe('queue / chaining', () => {
        it('chaining returns the same UnitTimer instance', () => {
            let timer!: UnitTimer;
            let chained: unknown;
            xnew(() => {
                timer = xnew.timeout(() => {}, 100);
                chained = timer.timeout(() => {}, 100);
            });
            expect(chained).toBe(timer);
        });

        it('queues a second timeout to run only after the first completes', () => {
            const first = jest.fn();
            const second = jest.fn();
            xnew(() => {
                xnew.timeout(first, 100).timeout(second, 100);
            });

            jest.advanceTimersByTime(100);
            expect(first).toHaveBeenCalledTimes(1);
            expect(second).not.toHaveBeenCalled();

            jest.advanceTimersByTime(100);
            expect(first).toHaveBeenCalledTimes(1);
            expect(second).toHaveBeenCalledTimes(1);
        });

        it('does not start a queued timeout under a destroying parent', () => {
            const second = jest.fn();
            let parent!: Unit;
            xnew((unit: Unit) => {
                parent = unit;
                xnew.timeout(() => {}, 100).timeout(second, 100);
            });

            parent.destroy();

            expect(parent._.children.length).toBe(0);
            jest.advanceTimersByTime(1000);
            expect(second).not.toHaveBeenCalled();
        });

        it('does not leak a queued infinite interval when the parent is destroyed', () => {
            const cb = jest.fn();
            let parent!: Unit;
            xnew((unit: Unit) => {
                parent = unit;
                xnew.timeout(() => {}, 100).interval(cb, 100, 0);
            });
            const running = jest.getTimerCount();

            parent.destroy();

            // the running task's timers are cleared and no queued task is started
            expect(jest.getTimerCount()).toBeLessThan(running);
            jest.advanceTimersByTime(10000);
            expect(cb).not.toHaveBeenCalled();
            expect(parent._.children.length).toBe(0);
        });

        it('runs each queued callback in the originating unit scope', () => {
            const observed: Array<Unit | null> = [];
            let target!: Unit;
            xnew((unit: Unit) => {
                target = unit;
                xnew
                    .timeout(() => observed.push(Unit.currentUnit), 100)
                    .timeout(() => observed.push(Unit.currentUnit), 100);
            });

            jest.advanceTimersByTime(200);

            expect(observed).toEqual([target, target]);
        });
    });
});
