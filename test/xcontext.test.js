import { XNode } from '../src/core/xnode';
import { xnew } from '../src/core/xnew';
import { xcontext } from '../src/core/xcontext';

beforeEach(() => {
    XNode.reset();
});

describe('xcontext', () => {
    it('basic', () => {
        xnew((xnode) => {
            expect(xcontext('hoge', 1)).toBe(undefined);
            expect(xcontext('hoge')).toBe(1);
            xnew((xnode) => {
                expect(xcontext('hoge')).toBe(1);
                xnew((xnode) => {
                    expect(xcontext('hoge', 2)).toBe(1);
                    expect(xcontext('hoge')).toBe(2);
                    xnew((xnode) => {
                        expect(xcontext('hoge')).toBe(2);
                    });
                });
                expect(xcontext('hoge')).toBe(1);
            });
        });
    });

});

