import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';

describe('Unit element hosting', () => {
    beforeEach(() => { Unit.reset(); });
    afterEach(() => { Unit.engineRoot?.finalize(); });

    describe('default host element', () => {
        it('defaults the element to document.body for a root-level unit', () => {
            const seen = jest.fn();
            xnew((u: Unit) => { seen(u.element); });
            expect(seen).toHaveBeenCalledWith(document.body);
        });

        it('inherits the parent element when no target is given', () => {
            let parentElement!: HTMLElement | SVGElement;
            let childElement!: HTMLElement | SVGElement;
            xnew('<div>', (p: Unit) => {
                parentElement = p.element;
                const child = xnew();
                childElement = child.element;
            });
            expect(childElement).toBe(parentElement);
        });
    });

    describe('target resolution', () => {
        it('creates the element from a tag string target', () => {
            let element!: HTMLElement | SVGElement;
            xnew('<div id="tag-host">', (u: Unit) => { element = u.element; });
            expect(element.id).toBe('tag-host');
            expect(document.getElementById('tag-host')).toBe(element);
        });

        it('uses a provided DOM element as the target', () => {
            const el = document.createElement('div');
            document.body.appendChild(el);
            let element!: HTMLElement | SVGElement;
            xnew(el, (u: Unit) => { element = u.element; });
            expect(element).toBe(el);
            el.remove();
        });
    });

    describe('xnew.nest', () => {
        it('creates and returns a nested element from a tag string', () => {
            let nested!: HTMLElement | SVGElement;
            xnew(() => { nested = xnew.nest('<div id="nested">'); });
            expect(nested).toBe(document.getElementById('nested'));
        });

        it('sets the text content when given as the second argument', () => {
            let nested!: HTMLElement | SVGElement;
            xnew(() => { nested = xnew.nest('<p id="with-text">', 'hello'); });
            expect(nested.textContent).toBe('hello');
        });

        it('rejects a DOM element target (tag strings only)', () => {
            const ext = document.createElement('span');
            document.body.appendChild(ext);
            expect(() => xnew(() => { xnew.nest(ext as any); })).toThrow('xnew.nest: invalid tag string');
            ext.remove();
        });
    });

    describe('finalize cleanup', () => {
        it('removes owned nested elements on finalize', () => {
            const unit = xnew(() => { xnew.nest('<div id="owned">'); });
            expect(document.getElementById('owned')).not.toBeNull();
            unit.finalize();
            expect(document.getElementById('owned')).toBeNull();
        });

        it('keeps an externally provided base element on finalize', () => {
            const ext = document.createElement('div');
            ext.id = 'external';
            document.body.appendChild(ext);
            const unit = xnew(ext, () => { xnew.nest('<div id="inner">'); });
            expect(document.getElementById('inner')).not.toBeNull();
            unit.finalize();
            expect(document.getElementById('inner')).toBeNull();
            expect(document.getElementById('external')).toBe(ext);
            ext.remove();
        });
    });
});
