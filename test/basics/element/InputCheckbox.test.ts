import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';
import { InputCheckbox } from '../../../src/basics/element/InputToggle';

describe('basics InputCheckbox', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        Unit.reset();
    });
    afterEach(() => {
        Unit.engineRoot?.destroy();
        jest.useRealTimers();
    });

    // unit.current is the container (carries the frame ring); the hidden input nests inside it
    function inputOf(unit: xnew.Unit): HTMLInputElement {
        return unit.current.querySelector('input') as HTMLInputElement;
    }

    // every value event a host would see, tagged by type, in order
    function record(unit: xnew.Unit): Array<[string, unknown]> {
        const seen: Array<[string, unknown]> = [];
        unit.on('input change', ({ event, value }: { event: Event, value: unknown }) => seen.push([event.type, value]));
        jest.advanceTimersByTime(0);
        return seen;
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
        expect(unit.current.hasAttribute('data-checked')).toBe(false);
        expect(unit.input.checked).toBe(false);
    });

    it('marks the box as checked when initially checked', () => {
        const unit = xnew(InputCheckbox, { value: true });

        expect(unit.current.hasAttribute('data-checked')).toBe(true);
        expect(unit.input.checked).toBe(true);
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
        expect(unit.current.hasAttribute('data-checked')).toBe(true);
        expect(unit.input.checked).toBe(true);

        input.checked = false;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        jest.advanceTimersByTime(1);
        expect(unit.current.hasAttribute('data-checked')).toBe(false);
        expect(unit.input.checked).toBe(false);
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

        expect(unit.current.className).toContain('boxed');
        expect(unit.current.getAttribute('style')).toContain('width: 2em;');
        expect(unit.current.getAttribute('style')).toContain('border-radius: 50%;');
    });

    // the container attribute is the only state a composed mark can style itself against
    it('keeps data-checked and the native input in step through a .value set', () => {
        const unit = xnew(InputCheckbox, { value: true });

        expect(unit.input.checked).toBe(true);
        expect(unit.current.hasAttribute('data-checked')).toBe(true);

        unit.value = false;

        expect(unit.input.checked).toBe(false);
        expect(unit.current.hasAttribute('data-checked')).toBe(false);
    });

    it('draws a default check mark svg when the caller composes none', () => {
        const unit = xnew(InputCheckbox);
        jest.advanceTimersByTime(0);

        expect(unit.current.querySelector('svg path')?.getAttribute('d')).toBe('M2 6 5 9 10 3');
    });

    it('lets an outer component compose the mark and suppresses the default', () => {
        const unit = xnew(() => {
            xnew.extend(InputCheckbox);
            xnew('<span class="my-mark">');
        });
        jest.advanceTimersByTime(0);

        expect(unit.current.querySelector('.my-mark')).not.toBeNull();
        expect(unit.current.querySelector('svg')).toBeNull();
    });

    it('suppresses the default when extended onto an outer component', () => {
        const unit = xnew(() => {
            xnew.extend(InputCheckbox);
        });
        jest.advanceTimersByTime(0);

        expect(unit.current.querySelector('svg')).toBeNull();
    });

    // the Gate driver is bound to the hidden input, so the setter's own event cannot re-enter it
    it('fires the native input + change pair once each on a .value set', () => {
        const unit = xnew(InputCheckbox);
        const seen = record(unit);

        unit.value = true;

        expect(seen).toEqual([['input', true], ['change', true]]);
    });

    it('reads and writes the checked state through .value', () => {
        const unit = xnew(InputCheckbox);
        jest.advanceTimersByTime(0);

        expect(unit.value).toBe(false);

        unit.value = true;
        jest.advanceTimersByTime(0);
        expect(unit.value).toBe(true);
        expect(inputOf(unit).checked).toBe(true);
        expect(unit.current.hasAttribute('data-checked')).toBe(true);

        unit.value = false;
        jest.advanceTimersByTime(1);
        expect(unit.value).toBe(false);
        expect(inputOf(unit).checked).toBe(false);
        expect(unit.current.hasAttribute('data-checked')).toBe(false);
    });

    it('exposes the hidden native checkbox through .input', () => {
        const unit = xnew(InputCheckbox, { value: true });

        expect(unit.input).toBe(inputOf(unit));
        expect(unit.input.checked).toBe(true);
    });
});
