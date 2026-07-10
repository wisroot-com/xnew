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

    describe('xnew.nest with an element definition object', () => {
        it('creates the element, embedding className / style and assigning the other members', () => {
            let nested!: HTMLInputElement;
            xnew(() => {
                nested = xnew.nest({
                    tag: 'input', type: 'text', name: 'user',
                    className: 'a b', style: 'width: 2em;',
                    value: 'he"llo', placeholder: 'type here',
                }) as HTMLInputElement;
            });
            expect(nested.tagName).toBe('INPUT');
            expect(nested.className).toBe('a b');
            expect(nested.getAttribute('style')).toBe('width: 2em;');
            expect(nested.name).toBe('user');
            expect(nested.type).toBe('text');
            expect(nested.value).toBe('he"llo');
            expect(nested.placeholder).toBe('type here');
            // value went through the property, so arbitrary text never touches the tag string
            expect(nested.outerHTML).not.toContain('llo');
        });

        it('escapes className / style in the generated tag string', () => {
            let nested!: HTMLElement | SVGElement;
            xnew(() => {
                nested = xnew.nest({ tag: 'div', className: 'a"b & c' });
            });
            expect(nested.tagName).toBe('DIV');
            expect(nested.className).toBe('a"b & c');
        });

        it('skips undefined / null / false members (conditional attributes)', () => {
            let nested!: HTMLInputElement;
            xnew(() => {
                nested = xnew.nest({ tag: 'input', name: undefined, checked: false, 'data-x': null }) as HTMLInputElement;
            });
            expect(nested.hasAttribute('name')).toBe(false);
            expect(nested.checked).toBe(false);
            expect(nested.hasAttribute('data-x')).toBe(false);
        });

        it('assigns boolean true through the property (checked)', () => {
            let nested!: HTMLInputElement;
            xnew(() => {
                nested = xnew.nest({ tag: 'input', type: 'checkbox', checked: true }) as HTMLInputElement;
            });
            expect(nested.checked).toBe(true);
        });

        it('falls back to setAttribute for non-property members', () => {
            let nested!: HTMLElement | SVGElement;
            xnew(() => {
                nested = xnew.nest({ tag: 'div', 'data-role': 'card', 'aria-hidden': true });
            });
            expect(nested.getAttribute('data-role')).toBe('card');
            expect(nested.getAttribute('aria-hidden')).toBe('true');
        });

        it('sets the text content when given as the second argument', () => {
            let nested!: HTMLElement | SVGElement;
            xnew(() => { nested = xnew.nest({ tag: 'p' }, 'hello'); });
            expect(nested.textContent).toBe('hello');
        });

        it('throws on an invalid tag name', () => {
            expect(() => xnew(() => { xnew.nest({ tag: 'in put' }); })).toThrow('invalid tag name');
        });
    });

    describe('element definition object as the xnew target', () => {
        it('creates the unit element from the definition', () => {
            let element!: HTMLElement | SVGElement;
            xnew({ tag: 'div', className: 'card' }, (u: Unit) => { element = u.element; });
            expect(element.tagName).toBe('DIV');
            expect(element.className).toBe('card');
        });

        it('accepts text content after the definition', () => {
            const unit = xnew({ tag: 'p', className: 'note' }, 'hello');
            expect(unit.element.textContent).toBe('hello');
            expect(unit.element.className).toBe('note');
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
