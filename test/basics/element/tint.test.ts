import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';
import { Button } from '../../../src/basics/element/Button';
import { InputCheckbox, InputSwitch } from '../../../src/basics/element/InputCheckbox';
import { InputRadio, InputRadioGroup } from '../../../src/basics/element/InputRadio';
import { Listbox, ListboxButton, ListboxItem, ListboxMenu } from '../../../src/basics/element/Listbox';

// One tint scale across every element: hover 10%, selected 20%, selected while hovered 30%. The last one
// is what keeps a selected row distinguishable while the pointer is on it — hover and selected used to
// share 20%, so they were indistinguishable. `:focus-within` is a different axis and stays out of this.
describe('basics element tint scale', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        Unit.reset();
    });
    afterEach(() => {
        Unit.engineRoot?.destroy();
        jest.useRealTimers();
    });

    // every state-tint rule in the stylesheet, as [selector, percentage]
    function tintRules(): Array<[string, number]> {
        const styleText = [...document.head.querySelectorAll('style')].map((style) => style.textContent).join('\n');
        const rules = styleText.matchAll(/(&[^{}\n]*)\{ background: color-mix\(in srgb, currentColor (\d+)%, transparent\); \}/g);
        return [...rules].map((rule) => [rule[1], Number(rule[2])] as [string, number]);
    }

    function buildEveryElement(): void {
        xnew(Button, { label: 'go' });
        xnew(InputCheckbox);
        xnew(InputSwitch);
        xnew(InputRadioGroup, { items: ['a', 'b'] });
        xnew(Listbox, { items: ['a', 'b'] });
        xnew(() => {
            xnew.extend(Listbox);
            xnew(ListboxButton);
            xnew(() => {
                xnew.extend(ListboxMenu);
                xnew(ListboxItem, { value: 'a' });
            });
        });
        xnew(InputRadio, { value: 'a', name: 'g' });
        jest.advanceTimersByTime(0);
    }

    const selected = (selector: string) => /\[data-checked\]|input:checked/.test(selector);
    const hovered = (selector: string) => selector.includes(':hover');
    const focus = (selector: string) => selector.includes(':focus');

    it('tints a plain hover at 10%', () => {
        buildEveryElement();
        const rules = tintRules().filter(([selector]) => hovered(selector) && !selected(selector) && !focus(selector));

        expect(rules.length).toBeGreaterThan(0);
        expect(rules.every(([, percent]) => percent === 10)).toBe(true);
    });

    it('tints a selected state at 20%', () => {
        buildEveryElement();
        const rules = tintRules().filter(([selector]) => selected(selector) && !hovered(selector));

        expect(rules.length).toBeGreaterThan(0);
        expect(rules.every(([, percent]) => percent === 20)).toBe(true);
    });

    // the whole point of the scale: selected must stay readable under the pointer
    it('tints a selected state under the pointer at 30%', () => {
        buildEveryElement();
        const rules = tintRules().filter(([selector]) => selected(selector) && hovered(selector));

        expect(rules.length).toBeGreaterThan(0);
        expect(rules.every(([, percent]) => percent === 30)).toBe(true);
    });

    // anything selectable has to say so under the pointer, or hover and selected read the same
    it('pairs every selected tint with a hovered one', () => {
        buildEveryElement();
        const rules = tintRules().filter(([selector]) => selected(selector));
        const plain = rules.filter(([selector]) => !hovered(selector)).length;
        const underPointer = rules.filter(([selector]) => hovered(selector)).length;

        expect(underPointer).toBe(plain);
    });
});
