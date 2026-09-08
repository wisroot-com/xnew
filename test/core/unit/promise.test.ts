import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';

describe('UnitPromise', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        Unit.reset();
    });
    afterEach(() => {
        Unit.engineRoot?.destroy();
        jest.useRealTimers();
    });

    it('resolves with the value and runs in the originating unit scope', async () => {
        const resolved = jest.fn();
        let target!: Unit;
        let scopeUnit: Unit | undefined;
        xnew((unit: Unit) => {
            target = unit;
            xnew.promise(Promise.resolve(42)).then((value: number) => {
                resolved(value);
                scopeUnit = Unit.currentUnit;
            });
        });

        await jest.advanceTimersByTimeAsync(0);

        expect(resolved).toHaveBeenCalledTimes(1);
        expect(resolved).toHaveBeenCalledWith(42);
        expect(scopeUnit).toBe(target);
    });

    it('catches a rejected promise', async () => {
        const caught = jest.fn();
        xnew(() => {
            xnew.promise(Promise.reject('err')).catch((reason: unknown) => {
                caught(reason);
            });
        });

        await jest.advanceTimersByTimeAsync(0);

        expect(caught).toHaveBeenCalledTimes(1);
        expect(caught).toHaveBeenCalledWith('err');
    });

    it('runs finally on resolve', async () => {
        const onFinally = jest.fn();
        xnew(() => {
            xnew.promise(Promise.resolve(1)).finally(() => onFinally());
        });

        await jest.advanceTimersByTimeAsync(0);

        expect(onFinally).toHaveBeenCalledTimes(1);
    });

    it('runs finally on reject', async () => {
        const onFinally = jest.fn();
        xnew(() => {
            // attach a catch so the rejection is handled and does not surface as unhandled
            xnew.promise(Promise.reject('boom')).finally(() => onFinally()).catch(() => {});
        });

        await jest.advanceTimersByTimeAsync(0);

        expect(onFinally).toHaveBeenCalledTimes(1);
    });

    it('does not run the callback if the unit was destroyed before the promise settles', async () => {
        const resolved = jest.fn();
        const unit = xnew(() => {
            xnew.promise(Promise.resolve(7)).then(() => resolved());
        });

        unit.destroy();

        await jest.advanceTimersByTimeAsync(0);

        expect(resolved).not.toHaveBeenCalled();
    });

    // catch / finally are cleanup, so unlike then they survive destroy: an error must not vanish silently
    it('still runs catch with the reason if the unit was destroyed before the promise rejects', async () => {
        const caught = jest.fn();
        const unit = xnew(() => {
            xnew.promise(Promise.reject('boom')).catch((reason: unknown) => caught(reason));
        });

        unit.destroy();

        await jest.advanceTimersByTimeAsync(0);

        expect(caught).toHaveBeenCalledTimes(1);
        expect(caught).toHaveBeenCalledWith('boom');
    });

    it('still runs finally if the unit was destroyed before the promise settles', async () => {
        const onFinally = jest.fn();
        const unit = xnew(() => {
            xnew.promise(Promise.resolve(1)).finally(() => onFinally());
        });

        unit.destroy();

        await jest.advanceTimersByTimeAsync(0);

        expect(onFinally).toHaveBeenCalledTimes(1);
    });

    it('runs a post-destroy finally outside the destroyed unit scope', async () => {
        let scopeUnit: Unit | undefined;
        let target!: Unit;
        const unit = xnew((self: Unit) => {
            target = self;
            xnew.promise(Promise.resolve(1)).finally(() => { scopeUnit = Unit.currentUnit; });
        });

        unit.destroy();

        await jest.advanceTimersByTimeAsync(0);

        expect(scopeUnit).not.toBe(target);
    });
});
