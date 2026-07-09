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

    function boxOf(unit: xnew.Unit): HTMLElement {
        return unit.element.parentElement as HTMLElement;
    }

    function checkOf(unit: xnew.Unit): SVGElement {
        return boxOf(unit).querySelector('svg') as SVGElement;
    }

    it('nests a hidden native checkbox input with the given attributes', () => {
        const unit = xnew(InputCheckbox, { value: true, name: 'flag' });
        const input = unit.element as HTMLInputElement;

        expect(input.tagName).toBe('INPUT');
        expect(input.getAttribute('type')).toBe('checkbox');
        expect(input.hasAttribute('checked')).toBe(true);
        expect(input.getAttribute('name')).toBe('flag');
    });

    it('defaults to unchecked (transparent check mark)', () => {
        const unit = xnew(InputCheckbox);

        expect((unit.element as HTMLInputElement).hasAttribute('checked')).toBe(false);
        expect(checkOf(unit).style.opacity).toBe('0');
    });

    it('shows the check mark when initially checked', () => {
        const unit = xnew(InputCheckbox, { value: true });

        expect(checkOf(unit).style.opacity).toBe('1');
    });

    it('toggles the check mark and box background on input', () => {
        const unit = xnew(InputCheckbox);
        const input = unit.element as HTMLInputElement;
        // compare class token lists: classList.toggle normalizes the raw className string
        const uncheckedClasses = Array.from(boxOf(unit).classList);
        jest.advanceTimersByTime(0);

        input.checked = true;
        input.dispatchEvent(new Event('input', { bubbles: false }));

        expect(checkOf(unit).style.opacity).toBe('1');
        expect(Array.from(boxOf(unit).classList)).not.toEqual(uncheckedClasses);

        input.checked = false;
        input.dispatchEvent(new Event('input', { bubbles: false }));

        expect(checkOf(unit).style.opacity).toBe('0');
        expect(Array.from(boxOf(unit).classList)).toEqual(uncheckedClasses);
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

    it('applies className and style to the container', () => {
        const unit = xnew(InputCheckbox, { className: 'check', style: 'width: 2em;' });

        expect(boxOf(unit).className).toContain('check');
        expect(boxOf(unit).getAttribute('style')).toContain('width: 2em;');
    });
});
