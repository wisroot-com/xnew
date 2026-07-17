import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';
import { InputSelect, InputSelectMenu, InputSelectItem } from '../../../src/basics/element/InputSelect';
import { Accordion } from '../../../src/basics/ui/Accordion';
import { Gate } from '../../../src/basics/ui/Gate';

describe('basics InputSelect', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        Unit.reset();
    });
    afterEach(() => {
        Unit.engineRoot?.finalize();
        jest.useRealTimers();
    });

    // InputSelect is extended into a unit (its element ends on the <select>); an InputSelectMenu binds
    // to the field (unit.container) and holds one InputSelectItem row per value.
    function build(props: any, values: string[]): { unit: xnew.Unit, menu: HTMLElement } {
        let menu!: HTMLElement;
        const unit = xnew((u) => {
            xnew.extend(InputSelect, props);
            xnew(u.container, (m: xnew.Unit) => {
                xnew.extend(InputSelectMenu);
                menu = m.container as HTMLElement;
                for (const value of values) {
                    xnew(InputSelectItem, { value });
                }
            });
        });
        return { unit, menu };
    }

    function selectOf(unit: xnew.Unit): HTMLSelectElement {
        return unit.element as HTMLSelectElement;
    }

    function fieldOf(unit: xnew.Unit): HTMLElement {
        return unit.container as HTMLElement;
    }

    function labelOf(unit: xnew.Unit): HTMLElement {
        return fieldOf(unit).firstElementChild as HTMLElement;
    }

    function rowsOf(menu: HTMLElement): HTMLElement[] {
        return Array.from(menu.querySelectorAll(':scope > div')) as HTMLElement[];
    }

    function isOpen(unit: xnew.Unit): boolean {
        return fieldOf(unit).hasAttribute('data-open');
    }

    function open(unit: xnew.Unit): void {
        jest.advanceTimersByTime(0);
        fieldOf(unit).dispatchEvent(new Event('click', { bubbles: false }));
        jest.advanceTimersByTime(0);
    }

    it('nests a hidden native select with the items and initial selection', () => {
        const { unit } = build({ value: 'mid', name: 'level' }, ['low', 'mid', 'high']);
        const el = selectOf(unit);

        expect(el.tagName).toBe('SELECT');
        expect(el.getAttribute('name')).toBe('level');
        expect(el.style.display).toBe('none');
        expect(Array.from(el.options).map((o) => o.value)).toEqual(['low', 'mid', 'high']);
        expect(el.value).toBe('mid');
        expect(labelOf(unit).textContent).toBe('mid');
    });

    it('defaults to the first item', () => {
        const { unit } = build({}, ['low', 'mid', 'high']);

        expect(selectOf(unit).value).toBe('low');
        expect(labelOf(unit).textContent).toBe('low');
    });

    it('keeps a default width that callers override via style', () => {
        const { unit } = build({}, ['low', 'mid']);
        const styleText = [...document.head.querySelectorAll('style')].map((s) => s.textContent).join('\n');

        expect(styleText).toContain('width: 10em;');
        expect(labelOf(unit).textContent).toBe('low');
    });

    it('toggles the floating option list on click', () => {
        const { unit, menu } = build({}, ['low', 'mid', 'high']);

        expect(menu.style.display).toBe('none');
        open(unit);
        expect(menu.style.display).not.toBe('none');
        // empty rows fall back to the value as text
        expect(menu.textContent).toBe('lowmidhigh');
        // fixed + max-content (in the menu css rule): the list escapes overflow-clipping ancestors
        // and outgrows the field; anchored to the field's viewport rect (all zero under jsdom)
        const styleText = [...document.head.querySelectorAll('style')].map((s) => s.textContent).join('\n');
        expect(menu.className).toMatch(/xnew\d+-menu/);
        expect(styleText).toContain('position: fixed; margin-top: 0.25em; width: max-content;');
        expect(menu.style.left).toBe('0px');
        expect(menu.style.top).toBe('0px');
        expect(menu.style.minWidth).toBe('0px');

        fieldOf(unit).dispatchEvent(new Event('click', { bubbles: false }));
        expect(menu.style.display).toBe('none');
    });

    it('selects an option: updates the label and the select, emits input, and closes', () => {
        const { unit, menu } = build({}, ['low', 'mid', 'high']);

        const received: string[] = [];
        unit.on('input', ({ value }: { value: string }) => received.push(value));

        open(unit);
        rowsOf(menu)[2].dispatchEvent(new Event('click', { bubbles: true }));

        expect(received).toEqual(['high']);
        expect(selectOf(unit).value).toBe('high');
        expect(labelOf(unit).textContent).toBe('high');
        expect(isOpen(unit)).toBe(false);
    });

    it('marks the current value with data-checked in the option list', () => {
        const { menu } = build({ value: 'mid' }, ['low', 'mid', 'high']);

        expect(rowsOf(menu).map((r) => r.hasAttribute('data-checked'))).toEqual([false, true, false]);
    });

    it('suppresses the field hover tint via data-open while the option list is open', () => {
        const { unit } = build({}, ['low', 'mid']);
        const styleText = [...document.head.querySelectorAll('style')].map((s) => s.textContent).join('\n');
        expect(styleText).toContain('&:not([data-open]):hover { background: color-mix(in srgb, currentColor 20%, transparent); }');

        expect(isOpen(unit)).toBe(false);
        open(unit);
        expect(isOpen(unit)).toBe(true);

        fieldOf(unit).dispatchEvent(new Event('click', { bubbles: false }));
        expect(isOpen(unit)).toBe(false);
    });

    it('lets each item nest its own row content, falling back to the value text when empty', () => {
        let menu!: HTMLElement;
        const unit = xnew((u) => {
            xnew.extend(InputSelect);
            xnew(u.container, (m: xnew.Unit) => {
                xnew.extend(InputSelectMenu);
                menu = m.container as HTMLElement;
                xnew(InputSelectItem, { value: 'plain' });
                xnew((item: xnew.Unit) => {
                    xnew.extend(InputSelectItem, { value: 'rich' });
                    xnew('<span class="tag">', 'RICH');
                });
            });
        });

        open(unit);
        const rows = rowsOf(menu);
        expect(rows[0].textContent).toBe('plain');
        expect(rows[1].querySelector('.tag')?.textContent).toBe('RICH');
        // the custom row keeps its own content instead of the value fallback
        expect(rows[1].textContent).toBe('RICH');
    });

    it('applies the InputSelect label design and InputSelectItem className to the rows', () => {
        let menu!: HTMLElement;
        const unit = xnew((u) => {
            xnew.extend(InputSelect, { designs: { label: { style: 'font-weight: bold;' } } });
            xnew(u.container, (m: xnew.Unit) => {
                xnew.extend(InputSelectMenu);
                menu = m.container as HTMLElement;
                xnew(InputSelectItem, { value: 'low', className: 'row' });
                xnew(InputSelectItem, { value: 'mid', className: 'row' });
            });
        });

        expect(labelOf(unit).getAttribute('style')).toContain('font-weight: bold;');
        expect(rowsOf(menu).every((o) => o.className.includes('row'))).toBe(true);
    });

    it('applies className and style to the InputSelectMenu element', () => {
        let menu!: HTMLElement;
        xnew((u) => {
            xnew.extend(InputSelect);
            xnew(u.container, (m: xnew.Unit) => {
                xnew.extend(InputSelectMenu, { className: 'panel', style: 'border-radius: 0.5em;' });
                menu = m.container as HTMLElement;
                xnew(InputSelectItem, { value: 'low' });
            });
        });

        expect(menu.className).toContain('panel');
        expect(menu.getAttribute('style')).toContain('border-radius: 0.5em;');
    });

    it('applies className and style to the field element', () => {
        const { unit } = build({ className: 'boxed', style: 'width: 12em;' }, ['low']);

        expect(fieldOf(unit).className).toContain('boxed');
        expect(fieldOf(unit).getAttribute('style')).toContain('width: 12em;');
    });

    it('wears the surface color behind the control on the option list', () => {
        const host = document.createElement('div');
        host.style.backgroundColor = 'rgb(1, 2, 3)';
        document.body.appendChild(host);
        let menu!: HTMLElement;
        const unit = xnew(host, (u: xnew.Unit) => {
            xnew.extend(InputSelect);
            xnew(u.container, (m: xnew.Unit) => {
                xnew.extend(InputSelectMenu);
                menu = m.container as HTMLElement;
                xnew(InputSelectItem, { value: 'low' });
                xnew(InputSelectItem, { value: 'mid' });
            });
        });

        open(unit);
        expect(menu.style.backgroundColor).toBe('rgb(1, 2, 3)');
        host.remove();
    });

    it('closes the option list on a pointerdown outside the control', () => {
        const { unit } = build({}, ['low', 'mid']);

        open(unit);
        expect(isOpen(unit)).toBe(true);
        document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
        expect(isOpen(unit)).toBe(false);
    });

    it('keeps the option list open on a pointerdown inside the control', () => {
        const { unit, menu } = build({}, ['low', 'mid']);

        open(unit);
        rowsOf(menu)[0].dispatchEvent(new Event('pointerdown', { bubbles: true }));
        expect(isOpen(unit)).toBe(true);
    });

    it('drives the menu open / close with a shared Gate, animating an Accordion over the same unit', () => {
        let menu!: HTMLElement;
        let accordion!: HTMLElement;
        const unit = xnew((u) => {
            xnew.extend(InputSelect);
            xnew(u.container, (m: xnew.Unit) => {
                // one shared Gate: the menu opens / closes it, the Accordion (after the menu) animates it
                const gate = xnew(Gate, { open: false, duration: 200 });
                xnew.extend(InputSelectMenu, { gate });
                xnew.extend(Accordion, { gate });
                menu = m.container as HTMLElement;
                accordion = m.element as HTMLElement;
                xnew(InputSelectItem, { value: 'low' });
                xnew(InputSelectItem, { value: 'mid' });
            });
        });

        // the gate's deferred initial emit sets the closed state; the Accordion follows it
        jest.advanceTimersByTime(0);
        expect(menu.style.display).toBe('none');
        expect(accordion.style.opacity).toBe('0');

        // open: the menu shows immediately, the Accordion expands to opacity 1 over the duration
        fieldOf(unit).dispatchEvent(new Event('click', { bubbles: false }));
        expect(menu.style.display).toBe('block');
        jest.advanceTimersByTime(250);
        expect(accordion.style.opacity).toBe('1');

        // close: the Accordion collapses; the menu stays shown until the gate reports fully closed
        fieldOf(unit).dispatchEvent(new Event('click', { bubbles: false }));
        expect(menu.style.display).toBe('block');
        jest.advanceTimersByTime(250);
        expect(accordion.style.opacity).toBe('0');
        expect(menu.style.display).toBe('none');
    });
});
