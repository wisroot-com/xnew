import { XNode } from '../src/core/xnode';
import { xnew } from '../src/core/xnew';

beforeEach(() => {
    XNode.boot();
});

describe('xnode timer', () => {
    it('basic', () => {
        return new Promise((resolve, reject) => {
            let state = 0;
            let start = Date.now();
            const margin = 100;
            setTimeout(() => {
                const d = Date.now() - start;
                expect(d).toBeGreaterThan(500 - margin);
                expect(d).toBeLessThan(500 + margin);
                state++;
            }, 500);
            setTimeout(() => state === 1 ? resolve() : reject(), 500 + margin);
        });
    });

});