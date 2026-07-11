import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';
import { InputCheckbox } from '../../../src/basics/element/InputCheckbox';

describe('basics InputCheckbox', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        Unit.reset();
    });
    afterEach(() => {
        Unit.engineRoot?.finalize();
        jest.useRealTimers();
    });

    // container > check > [svg, input]
    function checkOf(unit: xnew.Unit): HTMLElement {
        return unit.element.parentElement as HTMLElement;
    }

    it('nests a hidden native checkbox input with the given attributes', () => {
        const unit = xnew(InputCheckbox, { value: true, name: 'flag' });
        const input = unit.element as HTMLInputElement;

        expect(input.tagName).toBe('INPUT');
        expect(input.getAttribute('type')).toBe('checkbox');
        expect(input.checked).toBe(true);
        expect(input.getAttribute('name')).toBe('flag');
    });

    it('defaults to unchecked', () => {
        const unit = xnew(InputCheckbox);

        expect((unit.element as HTMLInputElement).checked).toBe(false);
        expect(checkOf(unit).hasAttribute('data-checked')).toBe(false);
    });

    it('marks the box as checked when initially checked', () => {
        const unit = xnew(InputCheckbox, { value: true });

        expect(checkOf(unit).hasAttribute('data-checked')).toBe(true);
    });

    it('carries the checked look in a data-checked css rule (check mark + tint)', () => {
        xnew(InputCheckbox);
        const styleText = [...document.head.querySelectorAll('style')].map((s) => s.textContent).join('\n');

        expect(styleText).toContain('svg { opacity: 0; }');
        expect(styleText).toContain('&[data-checked] { background: color-mix(in srgb, currentColor 20%, transparent); }');
        expect(styleText).toContain('&[data-checked] svg { opacity: 1; }');
    });

    it('toggles data-checked on input', () => {
        const unit = xnew(InputCheckbox);
        const input = unit.element as HTMLInputElement;
        jest.advanceTimersByTime(0);

        input.checked = true;
        input.dispatchEvent(new Event('input', { bubbles: false }));
        expect(checkOf(unit).hasAttribute('data-checked')).toBe(true);

        input.checked = false;
        input.dispatchEvent(new Event('input', { bubbles: false }));
        expect(checkOf(unit).hasAttribute('data-checked')).toBe(false);
    });

    it('delivers a boolean value to input listeners', () => {
        const unit = xnew(InputCheckbox);
        const input = unit.element as HTMLInputElement;

        const received: boolean[] = [];
        unit.on('input', ({ value }: { value: boolean }) => received.push(value));
        jest.advanceTimersByTime(0);
        input.checked = true;
        input.dispatchEvent(new Event('input', { bubbles: false }));

        expect(received).toEqual([true]);
    });

    it('sets the name attribute only when given', () => {
        const named = xnew(InputCheckbox, { name: 'flag' });
        const anonymous = xnew(InputCheckbox);

        expect((named.element as HTMLInputElement).getAttribute('name')).toBe('flag');
        expect((anonymous.element as HTMLInputElement).hasAttribute('name')).toBe(false);
    });

    it('applies designs to the check part', () => {
        const unit = xnew(InputCheckbox, { designs: { check: { className: 'round', style: 'border-radius: 50%;' } } });
        const check = checkOf(unit);

        expect(check.className).toContain('round');
        expect(check.getAttribute('style')).toContain('border-radius: 50%;');
    });

    it('applies className and style to the container (exposed via the getter)', () => {
        const unit = xnew(InputCheckbox, { className: 'boxed', style: 'width: 2em;' });

        expect(unit.container).toBe(checkOf(unit).parentElement);
        expect(unit.container.className).toContain('boxed');
        expect(unit.container.getAttribute('style')).toContain('width: 2em;');
    });
});
