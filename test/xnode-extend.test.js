import { XNode } from '../src/core/xnode';
import { xnew, xextend } from '../src/core/xnew';

beforeEach(() => {
    XNode.reset();
});

describe('xnode extend', () => {

    it('basic', () => {
        const xnode = xnew(Derived);

        function Base(xnode) {
            return {
                test1() {
                    return 1;
                },
            }
        }

        function Derived(xnode) {
            const props = xextend(Base);
            return {
                test1() {
                    return props.test1() + 1;
                }
            }
        }
        expect(xnode.test1()).toBe(2);
    });

});