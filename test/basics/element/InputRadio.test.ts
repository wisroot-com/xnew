import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';
import { InputRadio, InputRadioGroup } from '../../../src/basics/element/InputRadio';

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

    // the same value a native pick delivers, so a host cannot tell the two apart
    it('announces the chosen value on a .checked set, staying silent on an uncheck', () => {
        const unit = xnew(InputRadio, { value: 'low', name: 'level' });
        const seen = record(unit);

        unit.checked = true;

        expect(seen).toEqual([['input', 'low'], ['change', 'low']]);

        unit.checked = false;

        expect(seen).toEqual([['input', 'low'], ['change', 'low']]);
    });

    it('delivers the same value on a native pick as on a .checked set', () => {
        const unit = xnew(InputRadio, { value: 'low', name: 'level' });
        const seen = record(unit);

        const input = unit.input as HTMLInputElement;
        input.checked = true;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));

        expect(seen).toEqual([['input', 'low'], ['change', 'low']]);
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

describe('basics InputRadioGroup', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        Unit.reset();
    });
    afterEach(() => {
        Unit.engineRoot?.destroy();
        jest.useRealTimers();
    });

    function inputsOf(unit: xnew.Unit): HTMLInputElement[] {
        return Array.from(unit.current.querySelectorAll('input')) as HTMLInputElement[];
    }

    function record(unit: xnew.Unit): Array<[string, unknown]> {
        const seen: Array<[string, unknown]> = [];
        unit.on('input change', ({ event, value }: { event: Event, value: unknown }) => seen.push([event.type, value]));
        jest.advanceTimersByTime(0);
        return seen;
    }

    it('draws one framed segment per item, picking the one matching value from tick 0', () => {
        const unit = xnew(InputRadioGroup, { value: 'mid', items: ['low', 'mid', 'high'] });
        jest.advanceTimersByTime(0);

        expect(inputsOf(unit).map((input) => input.value)).toEqual(['low', 'mid', 'high']);
        expect(inputsOf(unit).map((input) => input.checked)).toEqual([false, true, false]);
        expect(unit.value).toBe('mid');
    });

    it('takes each segment label from an item def, falling back to its value', () => {
        const unit = xnew(InputRadioGroup, { items: [{ value: 'low', label: '低' }, 'mid'] });
        jest.advanceTimersByTime(0);

        expect(unit.current.textContent).toBe('低mid');
    });

    // an empty name groups nothing in HTML, so a group that is handed none must still make one up
    it('shares one generated name across its segments, and a different one per group', () => {
        const first = xnew(InputRadioGroup, { items: ['a', 'b'] });
        const second = xnew(InputRadioGroup, { items: ['a', 'b'] });
        jest.advanceTimersByTime(0);

        const names = inputsOf(first).map((input) => input.name);
        expect(names[0]).not.toBe('');
        expect(names).toEqual([names[0], names[0]]);
        expect(inputsOf(second)[0].name).not.toBe(names[0]);
    });

    it('keeps an explicit name over the generated one', () => {
        const unit = xnew(InputRadioGroup, { name: 'level', items: ['a', 'b'] });
        jest.advanceTimersByTime(0);

        expect(inputsOf(unit).map((input) => input.name)).toEqual(['level', 'level']);
    });

    it('reads and writes the pick through .value, firing the native input + change pair on the group', () => {
        const unit = xnew(InputRadioGroup, { value: 'low', items: ['low', 'mid', 'high'] });
        const seen = record(unit);

        unit.value = 'high';

        expect(unit.value).toBe('high');
        expect(inputsOf(unit).map((input) => input.checked)).toEqual([false, false, true]);
        expect(seen).toEqual([['input', 'high'], ['change', 'high']]);
    });

    // the segment's own events stay inside: a host sees exactly one pair, from the group
    it('announces a segment press as the group own value event', () => {
        const unit = xnew(InputRadioGroup, { value: 'low', items: ['low', 'mid', 'high'] });
        const seen = record(unit);

        inputsOf(unit)[2].click();

        expect(unit.value).toBe('high');
        expect(seen).toEqual([['input', 'high'], ['change', 'high']]);
    });

    it('reads an unselected group as an empty string', () => {
        const unit = xnew(InputRadioGroup, { items: ['low', 'mid'] });
        jest.advanceTimersByTime(0);

        expect(unit.value).toBe('');
    });

    it('applies a composed value to segments the caller nested itself', () => {
        let group!: xnew.Unit;
        xnew(() => {
            group = xnew(() => {
                xnew.extend(InputRadioGroup, { value: 'mid' });
                xnew(InputRadio, { value: 'low' });
                xnew(InputRadio, { value: 'mid' });
            });
        });
        jest.advanceTimersByTime(0);

        expect(group.value).toBe('mid');
        expect(inputsOf(group).map((input) => input.checked)).toEqual([false, true]);
    });

    it('drops a destroyed segment from the registry, leaving later writes untouched by it', () => {
        let segments!: xnew.Unit[];
        let group!: xnew.Unit;
        xnew(() => {
            group = xnew(() => {
                xnew.extend(InputRadioGroup, { value: 'low' });
                segments = [xnew(InputRadio, { value: 'low' }), xnew(InputRadio, { value: 'mid' })];
            });
        });
        jest.advanceTimersByTime(0);

        segments[0].destroy();

        expect(() => { group.value = 'mid'; }).not.toThrow();
        expect(group.value).toBe('mid');
    });
});
