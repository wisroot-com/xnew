import { XNode } from '../src/core/xnode';
import { xnew } from '../src/core/xnew';

beforeEach(() => {
    XNode.reset();
});

describe('xnode extend', () => {

    it('basic', () => {
        const xnode = xnew(Derived);

        function Base() {
            return {
                test1() {
                    return 1;
                },
            }
        }

        function Derived() {
            const props = xnew.extend(Base);
            return {
                test1() {
                    return props.test1() + 1;
                }
            }
        }
        expect(xnode.test1()).toBe(2);
    });

});