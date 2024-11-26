import { XNode } from '../src/core/xnode';
import { xnew } from '../src/core/xnew';
import { xtimer } from '../src/core/xtimer';

beforeEach(() => {
    XNode.reset();
});

describe('xnode timer', () => {
    it('basic', () => {
        return new Promise((resolve, reject) => {
            const start = Date.now();
            xtimer(() => {
                const diff = Date.now() - start;
                expect(diff).toBeGreaterThan(900);
                expect(diff).toBeLessThan(1100);
                resolve();
            }, 1000);
        });
    });

});