import { XNode } from '../src/core/xnode';
import { xnew } from '../src/core/xnew';
import { xtimer } from '../src/core/xtimer';

beforeEach(() => {
    XNode.reset();
});

describe('xnode timer', () => {
    it('basic', () => {
        return new Promise((resolve, reject) => {
            let state = false;
            const start = Date.now();
            const margin = 50;
            xtimer(() => {
                const d = Date.now() - start;
                expect(d).toBeGreaterThan(500 - margin);
                expect(d).toBeLessThan(500 + margin);
                state = true;
            }, 500);
            setTimeout(() => state ? resolve() : reject(), 500 + margin);
        });
    });

});