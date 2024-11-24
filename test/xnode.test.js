import { XNode } from '../src/core/xnode';
import { xnew } from '../src/core/xnew';

beforeEach(() => {
    XNode.initialize();
});

describe('xnode', () => {
    it('xnode relation', () => {
        const xnode1 = xnew();
        const xnode2 = xnew(xnode1);
        expect(xnode1.parent).toBe(null);
        expect(xnode2.parent).toBe(xnode1);
    });
    it('xnode relation nest', () => {
        xnew((xnode1) => {
            const xnode2 = xnew();
            expect(xnode1.parent).toBe(null);
            expect(xnode2.parent).toBe(xnode1);
        })
    });

    it('element', () => {
        xnew((xnode1) => {
            const xnode2 = xnew();
            expect(xnode1.element).toBe(document.body);
            expect(xnode2.element).toBe(document.body);
        })
    });

    it('element nest', () => {
        xnew((xnode1) => {
            xnode1.nest({ tag: 'div', name: 'test' });
            const xnode2 = xnew();
            expect(xnode1.element).toBe(document.querySelector('div[name=test]'));
            expect(xnode2.element).toBe(document.querySelector('div[name=test]'));
        })
    });

    it('element delete', () => {
        const xnode1 = xnew((xnode1) => {
            xnode1.nest({ tag: 'div', name: 'test' });
        })
        expect(xnode1.element).toBe(document.querySelector('div[name=test]'));
        xnode1.finalize();
        expect(document.querySelector('div[name=test]')).toBe(null);
    });
});