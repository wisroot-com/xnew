import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';
import { InputRadio } from '../../../src/basics/element/InputRadio';

describe('basics InputRadio', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        Unit.reset();
    });
    afterEach(() => {
        Unit.engineRoot?.destroy();
        jest.useRealTimers();
    });

    // each InputRadio is a <label> (its value as text) wrapping a hidden native <input type="radio">;
    // the unit's element is the label container, and the input is a child unit nested inside it
    function partsOf(unit: xnew.Unit): { label: HTMLElement, input: HTMLInputElement } {
        const label = unit.current as HTMLElement;
        return { label, input: label.querySelector('input') as HTMLInputElement };
    }

    // every value event a host would see, tagged by type, in order
    function record(unit: xnew.Unit): Array<[string, unknown]> {
        const seen: Array<[string, unknown]> = [];
        unit.on('input change', ({ event, value }: { event: Event, value: unknown }) => seen.push([event.type, value]));
        jest.advanceTimersByTime(0);
        return seen;
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
        const inputs = Array.from(container.current.querySelectorAll('input')) as HTMLInputElement[];

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

    it('fires the native input + change pair on a .checked set', () => {
        const unit = xnew(InputRadio, { value: 'low', name: 'level' });
        const seen = record(unit);

        unit.checked = true;

        expect(seen).toEqual([['input', true], ['change', true]]);
    });

    it('reads this segment own value through .value', () => {
        const unit = xnew(InputRadio, { value: 'low', name: 'level' });

        expect(unit.value).toBe('low');
    });

    it('reads and writes the segment checked state through .checked, unchecking siblings', () => {
        let first!: xnew.Unit;
        let second!: xnew.Unit;
        xnew('<div>', () => {
            first = xnew(InputRadio, { name: 'g', value: 'a', checked: true });
            second = xnew(InputRadio, { name: 'g', value: 'b' });
        });

        expect(first.checked).toBe(true);
        expect(second.checked).toBe(false);

        second.checked = true;
        expect(second.checked).toBe(true);
        expect(first.checked).toBe(false);
    });

    it('exposes the hidden native radio through .input', () => {
        const unit = xnew(InputRadio, { value: 'low', name: 'level', checked: true });

        expect(unit.input).toBe(partsOf(unit).input);
        expect(unit.input.checked).toBe(true);
    });
});
