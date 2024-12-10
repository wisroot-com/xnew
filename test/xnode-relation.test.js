import { XNode } from '../src/core/xnode';
import { xnew } from '../src/core/xnew';

beforeEach(() => {
    XNode.boot();
});

describe('xnode relation', () => {
    it('basic', () => {
        const xnode1 = xnew();
        const xnode2 = xnew(xnode1);
        expect(xnode1.parent).toBe(null);
        expect(xnode2.parent).toBe(xnode1);
    });

    it('nest', () => {
        xnew((xnode1) => {
            const xnode2 = xnew();
            expect(xnode1.parent).toBe(null);
            expect(xnode2.parent).toBe(xnode1);
        })
    });

    it('delete', () => {
        xnew((xnode1) => {
            const xnode2 = xnew();
            expect(xnode1.parent).toBe(null);
            expect(xnode2.parent).toBe(xnode1);
        })
    });
});