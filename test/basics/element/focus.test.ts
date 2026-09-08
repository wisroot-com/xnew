import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';
import { Button } from '../../../src/basics/element/Button';
import { ColorPicker } from '../../../src/basics/element/ColorPicker';
import { InputCheckbox } from '../../../src/basics/element/InputCheckbox';
import { InputNumber } from '../../../src/basics/element/InputNumber';
import { InputRadio, InputRadioGroup } from '../../../src/basics/element/InputRadio';
import { InputRange } from '../../../src/basics/element/InputRange';
import { InputSwitch } from '../../../src/basics/element/InputSwitch';
import { InputText } from '../../../src/basics/element/InputText';
import { Listbox, ListboxButton, ListboxMenu } from '../../../src/basics/element/Listbox';

// Toggles, radios and ranges hide their native input at width/height 0 and opacity 0, so the browser's own
// focus ring is drawn at zero size — reachable by Tab with nothing to see. Each operated box therefore
// carries the ring itself, on the container: `:focus-visible` for the ones that ARE the control (Button),
// `:has(:focus-visible)` for the ones wrapping a hidden input. It is an outline, not a tint, so it cannot
// be confused with the selected state, and `:focus-visible` keeps it off a plain mouse press.
const RING = '&:focus-visible, &:has(:focus-visible) { outline: 2px solid currentColor; outline-offset: 1px; }';

describe('basics element focus ring', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        Unit.reset();
    });
    afterEach(() => {
        Unit.engineRoot?.destroy();
        jest.useRealTimers();
    });

    function styleSheet(): string {
        return [...document.head.querySelectorAll('style')].map((style) => style.textContent).join('\n');
    }

    // a css rule body, counting braces: the nested `&:hover { … }` rules make a plain split unreliable
    function ruleOf(element: HTMLElement, part = 'container'): string {
        const name = element.className.split(' ').find((entry) => new RegExp(`^xnew\\d+-${part}$`).test(entry));
        const text = styleSheet();
        const start = text.indexOf('.' + name + ' {');
        if (start < 0) {
            return '';
        }
        let depth = 0;
        for (let index = text.indexOf('{', start); index < text.length; index++) {
            depth += text[index] === '{' ? 1 : text[index] === '}' ? -1 : 0;
            if (depth === 0) {
                return text.slice(start, index + 1);
            }
        }
        return '';
    }

    const OPERATED = [
        { name: 'Button', Component: Button as any, props: { text: 'go' } },
        { name: 'InputText', Component: InputText as any, props: undefined },
        { name: 'InputNumber', Component: InputNumber as any, props: undefined },
        { name: 'InputRange', Component: InputRange as any, props: undefined },
        { name: 'InputCheckbox', Component: InputCheckbox as any, props: undefined },
        { name: 'InputSwitch', Component: InputSwitch as any, props: undefined },
        { name: 'InputRadio', Component: InputRadio as any, props: { value: 'a', name: 'g' } },
    ];

    it.each(OPERATED)('$name rings its own box on keyboard focus', ({ Component, props }) => {
        const unit = xnew(Component, props);
        jest.advanceTimersByTime(0);

        expect(ruleOf(unit.current as HTMLElement)).toContain(RING);
    });

    it('rings the Listbox trigger, which is the box a keyboard user lands on', () => {
        let button!: xnew.Unit;
        xnew(() => {
            xnew.extend(Listbox);
            button = xnew(ListboxButton);
            xnew(() => { xnew.extend(ListboxMenu); });
        });
        jest.advanceTimersByTime(0);

        expect(ruleOf(button.current as HTMLElement)).toContain(RING);
    });

    it('rings each ColorPicker field rather than the whole panel', () => {
        const unit = xnew(ColorPicker, {});
        jest.advanceTimersByTime(0);
        const field = unit.current.querySelector('input') as HTMLInputElement;

        expect(ruleOf(field, 'fieldInput')).toContain(RING);
        expect(ruleOf(unit.current as HTMLElement)).not.toContain(RING);
    });

    // a group would draw a second ring around the segment that already has one
    it('leaves the radio group container unringed, the segment carries it', () => {
        const group = xnew(InputRadioGroup, { items: ['a', 'b'] });
        jest.advanceTimersByTime(0);

        expect(ruleOf(group.current as HTMLElement)).not.toContain(RING);
    });

    // an outline, never a tint: a tint at 20% would read exactly like the selected state
    it('uses an outline so focus never reads as selected', () => {
        for (const entry of OPERATED) {
            xnew(entry.Component, entry.props);
        }
        jest.advanceTimersByTime(0);
        const focusRules = [...styleSheet().matchAll(/&:focus[^{]*\{([^}]*)\}/g)].map((match) => match[1]);

        expect(focusRules.length).toBeGreaterThan(0);
        // the only focus rule allowed to paint a background is the :focus-within "being edited" tint
        expect(focusRules.every((body) => body.includes('outline:') || body.includes('background:'))).toBe(true);
        expect(focusRules.filter((body) => body.includes('outline:')).every((body) => !body.includes('background:'))).toBe(true);
    });
});
