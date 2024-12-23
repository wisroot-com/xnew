import { XNode } from '../src/core/xnode';
import { xnew } from '../src/core/xnew';

beforeEach(() => {
    XNode.reset();
});

describe('xnode context', () => {

    it('component', () => {
        const xnode1 = xnew(A);
        const xnode2 = xnew(B);
        const xnode3 = xnew(C);
        function A() {
        }
        function B() {
        }
        function C() {
        }

        expect(xnew.find(A)[0]).toBe(xnode1);
        expect(xnew.find(B)[0]).toBe(xnode2);
        expect(xnew.find(C)[0]).toBe(xnode3);
    });
});

