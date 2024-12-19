import { XNode } from '../src/core/xnode';
import { xnew, xthis } from '../src/core/xnew';

beforeEach(() => {
    XNode.reset();
});

describe('xnode relation', () => {
    it('basic', () => {
        const xnode1 = xnew();
        const xnode2 = xnew(xnode1);
        expect(xnode1.parent).toBe(null);
        expect(xnode2.parent).toBe(xnode1);
    });

    it('nest', () => {
        xnew(() => {
            const xnode1 = xthis();
            const xnode2 = xnew();
            expect(xnode1.parent).toBe(null);
            expect(xnode2.parent).toBe(xnode1);
        })
    });

    it('delete', () => {
        xnew(() => {
            const xnode1 = xthis();
            const xnode2 = xnew();
            expect(xnode1.parent).toBe(null);
            expect(xnode2.parent).toBe(xnode1);
        })
    });
});