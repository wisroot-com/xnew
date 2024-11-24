import { XNode } from '../src/core/xnode';
import { xnew } from '../src/core/xnew';

beforeEach(() => {
    XNode.initialize();
});

describe('xnode element', () => {

    it('basic', () => {
        xnew((xnode1) => {
            const xnode2 = xnew();
            expect(xnode1.element).toBe(document.body);
            expect(xnode2.element).toBe(document.body);
        })
    });

    it('nest', () => {
        xnew((xnode1) => {
            xnode1.nest({ tag: 'div', name: 'test' });
            const xnode2 = xnew();
            expect(xnode1.element).toBe(document.querySelector('div[name=test]'));
            expect(xnode2.element).toBe(document.querySelector('div[name=test]'));
        })
    });

    it('delete', () => {
        const xnode1 = xnew((xnode1) => {
            xnode1.nest({ tag: 'div', name: 'test' });
        })
        expect(xnode1.element).toBe(document.querySelector('div[name=test]'));
        xnode1.finalize();
        expect(document.querySelector('div[name=test]')).toBe(null);
    });
});