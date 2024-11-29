import { XNode } from '../src/core/xnode';
import { xnew } from '../src/core/xnew';

beforeEach(() => {
    XNode.reset();
});

describe('xnode context', () => {
    it('basic', () => {
        xnew((xnode) => {
            expect(xnode.context('hoge', 1)).toBe(undefined);
            expect(xnode.context('hoge')).toBe(1);
            xnew((xnode) => {
                expect(xnode.context('hoge')).toBe(1);
                xnew((xnode) => {
                    expect(xnode.context('hoge', 2)).toBe(1);
                    expect(xnode.context('hoge')).toBe(2);
                    xnew((xnode) => {
                        expect(xnode.context('hoge')).toBe(2);
                    });
                });
                expect(xnode.context('hoge')).toBe(1);
            });
        });
    });

});

