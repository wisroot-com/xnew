import { Unit } from '../../src/core/unit';
import { xnew, xsync } from '../../src/index';

describe('xsync.state', () => {
    beforeEach(() => { jest.useFakeTimers({ now: 0 }); Unit.reset(); });
    afterEach(() => { Unit.engineRoot?.destroy(); jest.useRealTimers(); });

    it('registers synced state on the current unit and returns the same reference', () => {
        let state!: Record<string, any>;
        const unit = xnew((u: Unit) => { state = xsync.state({ position: 0 }); });
        expect((unit)._.sync.state).toBe(state);
        expect(state.position).toBe(0);
    });

    it('merges on repeated calls, keeping the same reference', () => {
        let s1!: Record<string, any>; let s2!: Record<string, any>;
        xnew((u: Unit) => { s1 = xsync.state({ a: 1 }); s2 = xsync.state({ b: 2 }); });
        expect(s1).toBe(s2);
        expect(s1).toEqual({ a: 1, b: 2 });
    });
});
