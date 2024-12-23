import { XNode } from '../src/core/xnode';
import { xnew } from '../src/core/xnew';

beforeEach(() => {
    XNode.reset();
});

describe('xnode element', () => {

    it('basic', () => {
        xnew(() => {
            const xnode1 = xnew.current;
            const xnode2 = xnew();
            expect(xnode1.element).toBe(document.body);
            expect(xnode2.element).toBe(document.body);
        })
    });

    it('create', () => {
        xnew(() => {
            const xnode1 = xnew.current;
            xnew.nest({ tagName: 'div', name: 'A' });
            expect(xnode1.element).toBe(document.querySelector('div[name=A]'));
        })
        xnew({ tagName: 'div', name: 'B' }, () => {
            const xnode2 = xnew.current;
            expect(xnode2.element).toBe(document.querySelector('div[name=B]'));
        })
    });

    it('nest', () => {
        const xnode1 = xnew(() => {
            const xnode1 = xnew.current;
            xnew.nest({ tagName: 'div', name: 'test' });
            const xnode2 = xnew();
            expect(xnode1.element).toBe(document.querySelector('div[name=test]'));
            expect(xnode2.element).toBe(document.querySelector('div[name=test]'));
        });
        xnode1.finalize();
    });

    it('delete', () => {
        const xnode1 = xnew(() => {
            xnew.nest({ tagName: 'div', name: 'test' });
        });
 
        expect(xnode1.element).toBe(document.querySelector('div[name=test]'));
        xnode1.finalize();
        expect(document.querySelector('div[name=test]')).toBe(null);
    });
});