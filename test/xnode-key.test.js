import { XNode } from '../src/core/xnode';
import { xnew } from '../src/core/xnew';
import { xfind } from '../src/core/xfind';

beforeEach(() => {
    XNode.reset();
});

describe('xnode context', () => {
    it('basic', () => {
        const xnode1 = xnew((xnode1) => {
            xnode1.key = 'aaa';
        });
        const xnode2 = xnew((xnode2) => {
            xnode2.key = 'bbb';
        });
        const xnode3 = xnew((xnode3) => {
            xnode3.key = 'bbb ccc';
        });

        expect(xfind('aaa')[0]).toBe(xnode1);
        expect(xfind('bbb')[0]).toBe(xnode2);
        expect(xfind('bbb')[1]).toBe(xnode3);
        expect(xfind('ccc')[0]).toBe(xnode3);
        expect(xfind('aaa bbb')[0]).toBe(xnode1);
        expect(xfind('aaa bbb')[1]).toBe(xnode2);
        expect(xfind('aaa bbb')[2]).toBe(xnode3);
    });

});

