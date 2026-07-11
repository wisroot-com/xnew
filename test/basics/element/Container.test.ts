import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';
import { Container } from '../../../src/basics/element/Container';

describe('basics Container', () => {
    beforeEach(() => { Unit.reset(); });
    afterEach(() => { Unit.engineRoot?.finalize(); });

    function styleText(): string {
        return [...document.head.querySelectorAll('style')].map((style) => style.textContent).join('\n');
    }

    it('nests a container div (exposed via the getter)', () => {
        const unit = xnew(Container);

        expect(unit.element.tagName).toBe('DIV');
        expect(unit.container).toBe(unit.element);
    });

    it('emits the given base as the @layer base shell rule', () => {
        xnew(Container, { base: 'box-sizing: border-box; width: 1.5rem; height: 1.5rem;' });

        expect(styleText()).toMatch(/^@layer base \{/);
        expect(styleText()).toContain('width: 1.5rem; height: 1.5rem;');
    });

    it('applies className and style to the container', () => {
        const unit = xnew(Container, { className: 'action', style: 'width: 8em;' });

        expect(unit.container.className).toContain('action');
        expect(unit.container.getAttribute('style')).toContain('width: 8em;');
    });

    it('receives subsequent nests inside the container when extended', () => {
        const unit = xnew((unit: xnew.Unit) => {
            xnew.extend(Container);
            xnew.nest('<span>');
        });

        expect(unit.element.tagName).toBe('SPAN');
        expect(unit.element.parentElement).toBe(unit.container);
    });
});
