import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';
import { InputRadio } from '../../../src/basics/element/InputRadio';

describe('basics InputRadio', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        Unit.reset();
    });
    afterEach(() => {
        Unit.engineRoot?.finalize();
        jest.useRealTimers();
    });

    // each InputRadio is a <label> (its value as text) wrapping a hidden native <input type="radio">;
    // the unit's element is the label container, and the input is a child unit nested inside it
    function partsOf(unit: xnew.Unit): { label: HTMLElement, input: HTMLInputElement } {
        const label = unit.element as HTMLElement;
        return { label, input: label.querySelector('input') as HTMLInputElement };
    }

    it('renders a label wrapping a hidden radio, with the value as its text', () => {
        const unit = xnew(InputRadio, { value: 'low', name: 'level' });
        const { label, input } = partsOf(unit);

        expect(label.tagName).toBe('LABEL');
        expect(label.textContent).toBe('low');
        expect(input.type).toBe('radio');
        expect(input.value).toBe('low');
        expect(input.name).toBe('level');
    });

    it('marks the radio checked from the checked prop', () => {
        const on = xnew(InputRadio, { value: 'a', name: 'g', checked: true });
        const off = xnew(InputRadio, { value: 'b', name: 'g' });

        expect(partsOf(on).input.checked).toBe(true);
        expect(partsOf(off).input.checked).toBe(false);
    });

    it('groups exclusively by a shared name (native radio behavior)', () => {
        const container = xnew('<div>', () => {
            xnew(InputRadio, { name: 'g', value: 'a', checked: true });
            xnew(InputRadio, { name: 'g', value: 'b' });
            xnew(InputRadio, { name: 'g', value: 'c' });
        });
        const inputs = Array.from(container.element.querySelectorAll('input')) as HTMLInputElement[];

        expect(inputs.map((i) => i.name)).toEqual(['g', 'g', 'g']);
        inputs[2].click();

        expect(inputs.map((i) => i.checked)).toEqual([false, false, true]);
    });

    it('carries the checked look in a :has(input:checked) css rule', () => {
        xnew(InputRadio, { value: 'a', name: 'g' });
        const styleText = [...document.head.querySelectorAll('style')].map((s) => s.textContent).join('\n');

        expect(styleText).toContain('&:has(input:checked) { background: color-mix(in srgb, currentColor 20%, transparent); }');
    });

    it('applies className / style to the label and forwards others to the input', () => {
        const unit = xnew(InputRadio, { value: 'a', name: 'g', className: 'seg', style: 'font-weight: bold;', disabled: true });
        const { label, input } = partsOf(unit);

        expect(label.className).toContain('seg');
        expect(label.getAttribute('style')).toContain('font-weight: bold;');
        expect(input.disabled).toBe(true);
    });
});
