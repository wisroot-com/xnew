import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';
import { Button } from '../../../src/basics/element/Button';
import { ColorPicker } from '../../../src/basics/widget/ColorPicker';
import { InputCheckbox, InputSwitch } from '../../../src/basics/element/InputCheckbox';
import { InputNumber } from '../../../src/basics/element/InputNumber';
import { InputRadio, InputRadioGroup } from '../../../src/basics/element/InputRadio';
import { InputRange } from '../../../src/basics/element/InputRange';
import { InputText } from '../../../src/basics/element/InputText';
import { Listbox } from '../../../src/basics/widget/Listbox';

// `disabled` is the one prop that does NOT follow the "others go to the leading element" rule: it also has
// to reach the outer container, which every component marks with data-disabled and dims through one shared
// css rule. Anything with a focusable native child disables that child too — pointer-events: none does not
// stop Tab from reaching it.
describe('basics element disabled convention', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        Unit.reset();
    });
    afterEach(() => {
        Unit.engineRoot?.destroy();
        jest.useRealTimers();
    });

    const CASES: Array<{ name: string, Component: any, props?: any, focusable: boolean }> = [
        { name: 'Button', Component: Button, props: { label: 'go' }, focusable: false },
        { name: 'InputText', Component: InputText, focusable: true },
        { name: 'InputNumber', Component: InputNumber, focusable: true },
        { name: 'InputRange', Component: InputRange, focusable: true },
        { name: 'InputCheckbox', Component: InputCheckbox, focusable: true },
        { name: 'InputSwitch', Component: InputSwitch, focusable: true },
        { name: 'InputRadio', Component: InputRadio, props: { value: 'a', name: 'g' }, focusable: true },
        { name: 'InputRadioGroup', Component: InputRadioGroup, props: { items: ['a', 'b'] }, focusable: true },
        { name: 'Listbox', Component: Listbox, props: { items: ['a', 'b'] }, focusable: false },
        { name: 'ColorPicker', Component: ColorPicker, focusable: true },
    ];

    it.each(CASES)('$name marks its container with data-disabled', ({ Component, props }) => {
        const unit = xnew(Component, { ...props, disabled: true });
        jest.advanceTimersByTime(0);

        expect(unit.current.hasAttribute('data-disabled')).toBe(true);
    });

    it.each(CASES)('$name leaves data-disabled off when not disabled', ({ Component, props }) => {
        const unit = xnew(Component, props);
        jest.advanceTimersByTime(0);

        expect(unit.current.hasAttribute('data-disabled')).toBe(false);
    });

    it.each(CASES.filter((entry) => entry.focusable))('$name disables the native inputs it hides', ({ Component, props }) => {
        const unit = xnew(Component, { ...props, disabled: true });
        jest.advanceTimersByTime(0);

        const inputs = Array.from(unit.current.querySelectorAll('input')) as HTMLInputElement[];
        expect(inputs.length).toBeGreaterThan(0);
        expect(inputs.every((input) => input.disabled)).toBe(true);
    });

    it.each(CASES)('$name dims itself through the shared data-disabled rule', ({ Component, props }) => {
        xnew(Component, { ...props, disabled: true });
        jest.advanceTimersByTime(0);
        const styleText = [...document.head.querySelectorAll('style')].map((style) => style.textContent).join('\n');

        expect(styleText).toContain('&[data-disabled] { opacity: 0.5; cursor: default; pointer-events: none; }');
    });

    // a group disables segments the caller nested itself, not only the ones it drew from `items`
    it('InputRadioGroup disables composed segments too', () => {
        let group!: xnew.Unit;
        xnew(() => {
            group = xnew(() => {
                xnew.extend(InputRadioGroup, { disabled: true });
                xnew(InputRadio, { value: 'a' });
                xnew(InputRadio, { value: 'b' });
            });
        });
        jest.advanceTimersByTime(0);

        const inputs = Array.from(group.current.querySelectorAll('input')) as HTMLInputElement[];
        expect(inputs.map((input) => input.disabled)).toEqual([true, true]);
    });
});
