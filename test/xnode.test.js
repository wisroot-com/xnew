import { xnew } from '../src/core/xnew';

describe('xnode', () => {
    it('parent-child relation', () => {
        {
            const xnode1 = xnew();
            const xnode2 = xnew(xnode1);
            expect(xnode1.parent).toBe(null);
            expect(xnode2.parent).toBe(xnode1);
        }
        {
            xnew((xnode1) => {
                const xnode2 = xnew();
                expect(xnode1.parent).toBe(null);
                expect(xnode2.parent).toBe(xnode1);
            })
        }
    });
});