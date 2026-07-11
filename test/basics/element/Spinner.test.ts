import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';
import { Spinner } from '../../../src/basics/element/Spinner';

describe('basics Spinner', () => {
    beforeEach(() => { Unit.reset(); });
    afterEach(() => { Unit.engineRoot?.finalize(); });

    function styleText(): string {
        return [...document.head.querySelectorAll('style')].map((s) => s.textContent).join('\n');
    }

    it('nests a div carrying the generated spinner class', () => {
        const unit = xnew(Spinner);
        const div = unit.element as HTMLDivElement;

        expect(div.tagName).toBe('DIV');
        expect(div.className).toMatch(/xnew\d+-spinner/);
    });

    it('injects the @keyframes rule inside the base layer with a scoped name', () => {
        const unit = xnew(Spinner);
        const text = styleText();

        expect(text).toMatch(/^@layer base \{/);
        expect(text).toMatch(/@keyframes xnew\d+-turn \{/);
        expect(text).toMatch(/animation: xnew\d+-turn/);

        unit.finalize();
        expect(styleText()).not.toContain('@keyframes');
    });

    it('applies className and style to the div', () => {
        const unit = xnew(Spinner, { className: 'loading', style: 'width: 2em;' });
        const div = unit.element as HTMLDivElement;

        expect(div.className).toContain('loading');
        expect(div.getAttribute('style')).toContain('width: 2em;');
    });
});
