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

    // unit.element is the container (carries the frame ring); the hidden input nests inside it
    function inputOf(unit: xnew.Unit): HTMLInputElement {
        return unit.element.querySelector('input') as HTMLInputElement;
    }

    it('nests a hidden native checkbox input with the given attributes', () => {
        const unit = xnew(InputCheckbox, { value: true, name: 'flag' });
        const input = inputOf(unit);

        expect(input.tagName).toBe('INPUT');
        expect(input.getAttribute('type')).toBe('checkbox');
        expect(input.checked).toBe(true);
        expect(input.getAttribute('name')).toBe('flag');
    });

    it('defaults to unchecked', () => {
        const unit = xnew(InputCheckbox);

        expect(inputOf(unit).checked).toBe(false);
        expect(unit.element.hasAttribute('data-checked')).toBe(false);
        expect(unit.value).toBe(false);
    });

    it('marks the box as checked when initially checked', () => {
        const unit = xnew(InputCheckbox, { value: true });

        expect(unit.element.hasAttribute('data-checked')).toBe(true);
        expect(unit.value).toBe(true);
    });

    it('carries the checked look in a data-checked css rule (check mark + tint)', () => {
        xnew(InputCheckbox);
        const styleText = [...document.head.querySelectorAll('style')].map((s) => s.textContent).join('\n');

        expect(styleText).toContain('&[data-checked] { background: color-mix(in srgb, currentColor 20%, transparent); }');
        expect(styleText).toContain('[data-checked] > & { opacity: 1; }');
    });

    it('toggles data-checked on input', () => {
        const unit = xnew(InputCheckbox);
        const input = inputOf(unit);
        jest.advanceTimersByTime(0);

        input.checked = true;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        jest.advanceTimersByTime(0);
        expect(unit.element.hasAttribute('data-checked')).toBe(true);
        expect(unit.value).toBe(true);

        input.checked = false;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        jest.advanceTimersByTime(1);
        expect(unit.element.hasAttribute('data-checked')).toBe(false);
        expect(unit.value).toBe(false);
    });

    it('delivers a boolean value to input listeners', () => {
        const unit = xnew(InputCheckbox);
        const input = inputOf(unit);

        const received: boolean[] = [];
        unit.on('input', ({ value }: { value: boolean }) => received.push(value));
        jest.advanceTimersByTime(0);
        input.checked = true;
        input.dispatchEvent(new Event('input', { bubbles: true }));

        expect(received).toEqual([true]);
    });

    it('sets the name attribute only when given', () => {
        const named = xnew(InputCheckbox, { name: 'flag' });
        const anonymous = xnew(InputCheckbox);

        expect(inputOf(named).getAttribute('name')).toBe('flag');
        expect(inputOf(anonymous).hasAttribute('name')).toBe(false);
    });

    it('applies className and style to the container element', () => {
        const unit = xnew(InputCheckbox, { className: 'boxed', style: 'width: 2em; border-radius: 50%;' });

        expect(unit.element.className).toContain('boxed');
        expect(unit.element.getAttribute('style')).toContain('width: 2em;');
        expect(unit.element.getAttribute('style')).toContain('border-radius: 50%;');
    });

    it('exposes the checked-state gate, reflecting it in .value', () => {
        const unit = xnew(InputCheckbox, { value: true });

        expect(unit.gate).toBeInstanceOf(xnew.Unit);
        expect(unit.gate.state).toBe('opened');

        unit.gate.close();
        jest.advanceTimersByTime(1);
        expect(unit.gate.state).toBe('closed');
        expect(unit.value).toBe(false);
        expect(unit.element.hasAttribute('data-checked')).toBe(false);
    });

    it('draws a default check mark svg when the caller composes none', () => {
        const unit = xnew(InputCheckbox);
        jest.advanceTimersByTime(0);

        expect(unit.element.querySelector('svg path')?.getAttribute('d')).toBe('M2 6 5 9 10 3');
    });

    it('lets a trailing function compose the mark and suppresses the default', () => {
        const unit = xnew(InputCheckbox, {}, (unit: xnew.Unit) => {
            xnew('<span class="my-mark">');
        });
        jest.advanceTimersByTime(0);

        expect(unit.element.querySelector('.my-mark')).not.toBeNull();
        expect(unit.element.querySelector('svg')).toBeNull();
    });
});
