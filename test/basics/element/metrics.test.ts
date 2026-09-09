import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';
import { Button } from '../../../src/basics/element/Button';
import { InputCheckbox, InputSwitch } from '../../../src/basics/element/InputCheckbox';
import { InputNumber } from '../../../src/basics/element/InputNumber';
import { InputRadioGroup } from '../../../src/basics/element/InputRadio';
import { InputRange } from '../../../src/basics/element/InputRange';
import { InputText } from '../../../src/basics/element/InputText';
import { Listbox, ListboxButton, ListboxItem, ListboxMenu } from '../../../src/basics/element/Listbox';

// Every element that carries a frame keeps the same box metrics: vertical-only margin (horizontal spacing
// is the caller's, through flex gap, so a side margin would double it) and, where the box may stretch, the
// same three-step max-width. The heights are deliberately NOT one value — see the height test below.
describe('basics element box metrics', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        Unit.reset();
    });
    afterEach(() => {
        Unit.engineRoot?.destroy();
        jest.useRealTimers();
    });

    const FRAMED = [
        { name: 'Button', Component: Button, props: { text: 'go' } },
        { name: 'InputText', Component: InputText as any, props: undefined },
        { name: 'InputNumber', Component: InputNumber as any, props: undefined },
        { name: 'InputRange', Component: InputRange as any, props: undefined },
        { name: 'InputCheckbox', Component: InputCheckbox as any, props: undefined },
        { name: 'InputSwitch', Component: InputSwitch as any, props: undefined },
        { name: 'InputRadioGroup', Component: InputRadioGroup as any, props: { items: ['a'] } },
        { name: 'Listbox', Component: Listbox as any, props: { items: ['a'] } },
    ];

    function styleSheet(): string {
        return [...document.head.querySelectorAll('style')].map((style) => style.textContent).join('\n');
    }

    // a css rule body, counting braces: the nested `&:hover { … }` rules make a plain split unreliable
    function ruleBody(styleText: string, name: string | undefined): string {
        const start = styleText.indexOf('.' + name + ' {');
        if (start < 0) {
            return '';
        }
        let depth = 0;
        for (let index = styleText.indexOf('{', start); index < styleText.length; index++) {
            depth += styleText[index] === '{' ? 1 : styleText[index] === '}' ? -1 : 0;
            if (depth === 0) {
                return styleText.slice(start, index + 1);
            }
        }
        return '';
    }

    it.each(FRAMED)('$name keeps its margin vertical-only', ({ Component, props }) => {
        const unit = xnew(Component, props);
        jest.advanceTimersByTime(0);
        const container = (unit.current as HTMLElement).className.split(' ').find((name) => /^xnew\d+-container$/.test(name));
        const rule = ruleBody(styleSheet(), container);

        expect(rule).toContain('margin: 0.125em 0;');
    });

    // a stretchable box has to fall back through all three spellings; 100% alone was ListboxButton's bug
    it('spells the stretch limit the same way everywhere it appears', () => {
        xnew(() => {
            xnew.extend(Listbox);
            xnew(ListboxButton);
            xnew(() => { xnew.extend(ListboxMenu); });
        });
        for (const entry of FRAMED) {
            xnew(entry.Component, entry.props);
        }
        jest.advanceTimersByTime(0);
        const text = styleSheet();

        const limits = [...text.matchAll(/max-width: (?!-webkit-fill-available|-moz-available|stretch)([^;]+);/g)];
        expect(limits.map((match) => match[1])).toEqual([]);
        expect(text).toContain('max-width: -webkit-fill-available; max-width: -moz-available; max-width: stretch;');
    });

    // three heights on purpose: the input row, the small toggle, the menu row a finger presses
    it('uses 1.8em for input rows, 1.5em for toggles and 2em for menu rows', () => {
        xnew(InputText);
        xnew(InputCheckbox);
        xnew(() => {
            xnew.extend(Listbox);
            xnew(ListboxButton);
            xnew(() => {
                xnew.extend(ListboxMenu);
                xnew(ListboxItem, { value: 'a' });
            });
        });
        jest.advanceTimersByTime(0);
        const text = styleSheet();

        expect(text).toContain('height: 1.8em;');
        expect(text).toContain('width: 1.5em; height: 1.5em;');
        expect(text).toContain('height: 2em;');
    });
});
