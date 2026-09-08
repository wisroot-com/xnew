import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';

describe('xnew.scope', () => {
    beforeEach(() => {
        Unit.reset();
    });
    afterEach(() => {
        Unit.engineRoot?.destroy();
    });

    it('captures the current unit scope into a callback', () => {
        let captured!: (...args: any[]) => any;
        let target!: Unit;
        xnew((unit: Unit) => {
            target = unit;
            captured = xnew.scope(() => Unit.currentUnit);
        });

        // invoked from outside the component, the wrapped callback re-enters the captured scope
        expect(captured()).toBe(target);
    });

    it('restores Unit.currentUnit to a different scope after invocation', () => {
        let capturedA!: (...args: any[]) => any;
        let unitA!: Unit;
        let unitB!: Unit;

        xnew((unit: Unit) => {
            unitA = unit;
            capturedA = xnew.scope(() => Unit.currentUnit);
        });

        // call the captured A-scope from inside a *different* unit's scope
        xnew((unit: Unit) => {
            unitB = unit;
            expect(capturedA()).toBe(unitA);
            // after the wrapped call returns, the outer (B) scope is restored
            expect(Unit.currentUnit).toBe(unitB);
        });

        expect(unitA).not.toBe(unitB);
    });

    it('passes arguments through to the wrapped callback', () => {
        let captured!: (...args: any[]) => any;
        xnew(() => {
            captured = xnew.scope((a: number, b: number, c: number) => [a, b, c]);
        });

        expect(captured(1, 2, 3)).toEqual([1, 2, 3]);
    });

    it('returns the wrapped callback result', () => {
        let captured!: (...args: any[]) => any;
        xnew(() => {
            captured = xnew.scope(() => 'result-value');
        });

        expect(captured()).toBe('result-value');
    });

    it('does not execute and returns undefined when the captured unit is destroyed', () => {
        const inner = jest.fn(() => 'should-not-run');
        let captured!: (...args: any[]) => any;
        let target!: Unit;
        xnew((unit: Unit) => {
            target = unit;
            captured = xnew.scope(inner);
        });

        target.destroy();

        expect(captured()).toBeUndefined();
        expect(inner).not.toHaveBeenCalled();
    });
});
