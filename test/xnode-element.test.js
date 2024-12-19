import { XNode } from '../src/core/xnode';
import { xnew, xthis, xnest } from '../src/core/xnew';

beforeEach(() => {
    XNode.reset();
});

describe('xnode element', () => {

    it('basic', () => {
        xnew(() => {
            const xnode1 = xthis();
            const xnode2 = xnew();
            expect(xnode1.element).toBe(document.body);
            expect(xnode2.element).toBe(document.body);
        })
    });

    it('create', () => {
        xnew(() => {
            const xnode1 = xthis();
            xnest({ tagName: 'div', name: 'A' });
            expect(xnode1.element).toBe(document.querySelector('div[name=A]'));
        })
        xnew({ tagName: 'div', name: 'B' }, () => {
            const xnode2 = xthis();
            expect(xnode2.element).toBe(document.querySelector('div[name=B]'));
        })
    });

    it('nest', () => {
        const xnode1 = xnew(() => {
            const xnode1 = xthis();
            xnest({ tagName: 'div', name: 'test' });
            const xnode2 = xnew();
            expect(xnode1.element).toBe(document.querySelector('div[name=test]'));
            expect(xnode2.element).toBe(document.querySelector('div[name=test]'));
        });
        xnode1.finalize();
    });

    it('delete', () => {
        const xnode1 = xnew(() => {
            xnest({ tagName: 'div', name: 'test' });
        });
 
        expect(xnode1.element).toBe(document.querySelector('div[name=test]'));
        xnode1.finalize();
        expect(document.querySelector('div[name=test]')).toBe(null);
    });
});