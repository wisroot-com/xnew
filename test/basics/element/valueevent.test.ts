import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';
import { ColorPicker } from '../../../src/basics/widget/ColorPicker';
import { InputCheckbox, InputSwitch } from '../../../src/basics/element/InputToggle';
import { InputNumber, InputText } from '../../../src/basics/element/InputField';
import { InputRadio, InputRadioGroup } from '../../../src/basics/element/InputRadio';
import { InputRange } from '../../../src/basics/element/InputRange';
import { Listbox } from '../../../src/basics/widget/Listbox';

// A `.value` set announces on the component's LEADING element — the hidden native input where there is
// one, the container where there is none — which is the same element a user's own interaction fires on.
// So `event.target` reads the same whichever way the value moved.
describe('basics element value event convention', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        Unit.reset();
    });
    afterEach(() => {
        Unit.engineRoot?.destroy();
        jest.useRealTimers();
    });

    const CASES: Array<{ name: string, Component: any, props?: any, write: (unit: xnew.Unit) => void, leading: 'input' | 'container' }> = [
        { name: 'InputText', Component: InputText, props: { value: 'a' }, write: (unit) => unit.value = 'b', leading: 'input' },
        { name: 'InputNumber', Component: InputNumber, props: { value: 1 }, write: (unit) => unit.value = 2, leading: 'input' },
        { name: 'InputRange', Component: InputRange, props: { value: 1 }, write: (unit) => unit.value = 2, leading: 'input' },
        { name: 'InputCheckbox', Component: InputCheckbox, write: (unit) => unit.value = true, leading: 'input' },
        { name: 'InputSwitch', Component: InputSwitch, write: (unit) => unit.value = true, leading: 'input' },
        { name: 'InputRadio', Component: InputRadio, props: { value: 'a', name: 'g' }, write: (unit) => unit.checked = true, leading: 'input' },
        { name: 'InputRadioGroup', Component: InputRadioGroup, props: { items: ['a', 'b'] }, write: (unit) => unit.value = 'b', leading: 'container' },
        { name: 'Listbox', Component: Listbox, props: { items: ['a', 'b'] }, write: (unit) => unit.value = 'b', leading: 'container' },
        { name: 'ColorPicker', Component: ColorPicker, props: { value: '#000000' }, write: (unit) => unit.value = '#ffffff', leading: 'container' },
    ];

    it.each(CASES)('$name announces a .value set on its $leading element', ({ Component, props, write, leading }) => {
        const unit = xnew(Component, props);
        const targets: EventTarget[] = [];
        unit.on('input change', ({ event }: { event: Event }) => targets.push(event.target as EventTarget));
        jest.advanceTimersByTime(0);

        write(unit);

        const expected = leading === 'input' ? unit.current.querySelector('input') : unit.current;
        expect(targets.length).toBe(2);
        expect(targets).toEqual([expected, expected]);
    });

    // the point of the rule: a host reading event.target cannot tell a programmatic write from a real one
    it.each(CASES.filter((entry) => entry.leading === 'input'))('$name puts a native interaction on the same element', ({ Component, props, write }) => {
        const unit = xnew(Component, props);
        const targets: EventTarget[] = [];
        unit.on('input change', ({ event }: { event: Event }) => targets.push(event.target as EventTarget));
        jest.advanceTimersByTime(0);

        write(unit);
        const fromWrite = targets[0];

        targets.length = 0;
        const input = unit.current.querySelector('input') as HTMLInputElement;
        input.dispatchEvent(new Event('input', { bubbles: true }));

        expect(targets[0]).toBe(fromWrite);
    });
});
