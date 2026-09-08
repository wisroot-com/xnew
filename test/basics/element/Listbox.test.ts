import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';
import { Listbox, ListboxButton, ListboxMenu, ListboxItem } from '../../../src/basics/element/Listbox';
import { Accordion } from '../../../src/basics/widget/Accordion';

describe('basics Listbox', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        Unit.reset();
    });
    afterEach(() => {
        Unit.engineRoot?.finalize();
        jest.useRealTimers();
    });

    // Listbox holds the state; a ListboxButton draws the framed trigger + label, and a ListboxMenu nests
    // the option rows. Each is put on its own unit with xnew.extend, so the body composes into it.
    function build(props: any, values: string[]): { box: xnew.Unit, button: xnew.Unit, menu: HTMLElement } {
        let box!: xnew.Unit;
        let button!: xnew.Unit;
        let menu!: HTMLElement;
        xnew(() => {
            box = xnew(() => {
                xnew.extend(Listbox, props);
                button = xnew(ListboxButton);
                xnew((m: xnew.Unit) => {
                    xnew.extend(ListboxMenu);
                    menu = m.current as HTMLElement;
                    for (const value of values) {
                        xnew(ListboxItem, { value });
                    }
                });
            });
        });
        return { box, button, menu };
    }

    function triggerOf(button: xnew.Unit): HTMLElement {
        return button.current as HTMLElement;
    }

    function labelOf(button: xnew.Unit): HTMLElement {
        return triggerOf(button).firstElementChild as HTMLElement;
    }

    function rowsOf(menu: HTMLElement): HTMLElement[] {
        return Array.from(menu.querySelectorAll(':scope > div')) as HTMLElement[];
    }

    // the default UI hangs under the host: backdrop -> anchor tether -> menu -> rows
    function defaultRowsOf(box: xnew.Unit): HTMLElement[] {
        const menu = (box.current as HTMLElement).lastElementChild!.firstElementChild!.firstElementChild as HTMLElement;
        return rowsOf(menu);
    }

    // the backdrop is Overlay's fixed container: menu -> anchor tether -> backdrop
    function backdropOf(menu: HTMLElement): HTMLElement {
        return menu.parentElement!.parentElement as HTMLElement;
    }

    function isOpen(button: xnew.Unit): boolean {
        return triggerOf(button).hasAttribute('data-open');
    }

    function open(button: xnew.Unit): void {
        jest.advanceTimersByTime(0);
        triggerOf(button).dispatchEvent(new Event('click', { bubbles: true }));
        jest.advanceTimersByTime(0);
    }

    it('holds the selection state with the initial value shown in the label', () => {
        const { box, button } = build({ value: 'mid' }, ['low', 'mid', 'high']);

        expect(box.value).toBe('mid');
        expect(labelOf(button).textContent).toBe('mid');
    });

    it('defaults to the first item', () => {
        const { box, button } = build({}, ['low', 'mid', 'high']);
        // the default is adopted one tick later, once every item has registered its value
        jest.advanceTimersByTime(0);

        expect(box.value).toBe('low');
        expect(labelOf(button).textContent).toBe('low');
    });

    it('keeps a default width on the trigger that callers override via style', () => {
        const { button } = build({}, ['low', 'mid']);
        // the default label text is adopted one tick after the items register
        jest.advanceTimersByTime(0);
        const styleText = [...document.head.querySelectorAll('style')].map((s) => s.textContent).join('\n');

        expect(styleText).toContain('width: 10em;');
        expect(labelOf(button).textContent).toBe('low');
    });

    it('toggles the floating option list on click', () => {
        const { button, menu } = build({}, ['low', 'mid', 'high']);

        expect(isOpen(button)).toBe(false);
        open(button);
        expect(isOpen(button)).toBe(true);
        // Overlay's backdrop turns visible and interactive while open
        expect(backdropOf(menu).style.opacity).toBe('1');
        expect(backdropOf(menu).style.pointerEvents).toBe('auto');
        // empty rows fall back to the value as text
        expect(menu.textContent).toBe('lowmidhigh');
        // the list hangs under Overlay's anchor-tracking box (absolute, top: 100%) instead of a fixed rect
        const styleText = [...document.head.querySelectorAll('style')].map((s) => s.textContent).join('\n');
        expect(menu.className).toMatch(/xnew\d+-container/);
        expect(styleText).toContain('position: absolute; top: 100%; left: 0;');

        triggerOf(button).dispatchEvent(new Event('click', { bubbles: true }));
        // data-open now clears once the gate reports fully closed, so let the close settle
        jest.advanceTimersByTime(300);
        expect(isOpen(button)).toBe(false);
        // the backdrop goes click-through once fully closed, so the page stays interactive
        expect(backdropOf(menu).style.opacity).toBe('0');
        expect(backdropOf(menu).style.pointerEvents).toBe('none');
    });

    it('selects an option: updates the label and value, emits -change, and closes', () => {
        const { box, button, menu } = build({}, ['low', 'mid', 'high']);

        const received: string[] = [];
        box.on('-change', ({ value }: { value: string }) => received.push(value));

        open(button);
        rowsOf(menu)[2].dispatchEvent(new Event('click', { bubbles: true }));

        expect(received).toEqual(['high']);
        expect(box.value).toBe('high');
        expect(labelOf(button).textContent).toBe('high');
        // data-open persists through the close animation and clears once the gate is fully closed
        jest.advanceTimersByTime(300);
        expect(isOpen(button)).toBe(false);
    });

    it('marks the current value with data-checked in the option list', () => {
        const { menu } = build({ value: 'mid' }, ['low', 'mid', 'high']);
        // the checked state is synced one tick later, once every item has registered
        jest.advanceTimersByTime(0);

        expect(rowsOf(menu).map((r) => r.hasAttribute('data-checked'))).toEqual([false, true, false]);
    });

    it('suppresses the trigger hover tint via data-open while the option list is open', () => {
        const { button } = build({}, ['low', 'mid']);
        const styleText = [...document.head.querySelectorAll('style')].map((s) => s.textContent).join('\n');
        expect(styleText).toContain('&:not([data-open]):hover { background: color-mix(in srgb, currentColor 20%, transparent); }');

        expect(isOpen(button)).toBe(false);
        open(button);
        expect(isOpen(button)).toBe(true);

        triggerOf(button).dispatchEvent(new Event('click', { bubbles: true }));
        // data-open is kept through the fade-out and removed once the gate reports fully closed
        jest.advanceTimersByTime(300);
        expect(isOpen(button)).toBe(false);
    });

    it('lets each item nest its own row content, falling back to the value text when empty', () => {
        let button!: xnew.Unit;
        let menu!: HTMLElement;
        xnew(() => {
            xnew(() => {
                xnew.extend(Listbox);
                button = xnew(ListboxButton);
                xnew((m: xnew.Unit) => {
                    xnew.extend(ListboxMenu);
                    menu = m.current as HTMLElement;
                    xnew(ListboxItem, { value: 'plain' });
                    xnew(() => {
                        xnew.extend(ListboxItem, { value: 'rich' });
                        xnew('<span class="tag">', 'RICH');
                    });
                });
            });
        });

        open(button);
        const rows = rowsOf(menu);
        expect(rows[0].textContent).toBe('plain');
        expect(rows[1].querySelector('.tag')?.textContent).toBe('RICH');
        // the custom row keeps its own content instead of the value fallback
        expect(rows[1].textContent).toBe('RICH');
    });

    it('lets an item nest its row text, decoupled from the value', () => {
        let box!: xnew.Unit;
        let button!: xnew.Unit;
        let menu!: HTMLElement;
        xnew(() => {
            box = xnew(() => {
                xnew.extend(Listbox);
                button = xnew(ListboxButton);
                xnew((m: xnew.Unit) => {
                    xnew.extend(ListboxMenu);
                    menu = m.current as HTMLElement;
                    xnew(() => {
                        xnew.extend(ListboxItem, { value: 'apple' });
                        xnew('<span>', 'りんご');
                    });
                });
            });
        });

        open(button);
        const rows = rowsOf(menu);
        // the nested text sets the row label; the value stays 'apple'
        expect(rows[0].textContent).toBe('りんご');
        rows[0].dispatchEvent(new Event('click', { bubbles: true }));
        expect(box.value).toBe('apple');
    });

    it('applies the ListboxItem className to the rows', () => {
        let menu!: HTMLElement;
        xnew(() => {
            xnew(() => {
                xnew.extend(Listbox);
                xnew(ListboxButton);
                xnew((m: xnew.Unit) => {
                    xnew.extend(ListboxMenu);
                    menu = m.current as HTMLElement;
                    xnew(ListboxItem, { value: 'low', className: 'row' });
                    xnew(ListboxItem, { value: 'mid', className: 'row' });
                });
            });
        });

        expect(rowsOf(menu).every((o) => o.className.includes('row'))).toBe(true);
    });

    it('applies className and style to the ListboxMenu element', () => {
        let menu!: HTMLElement;
        xnew(() => {
            xnew(() => {
                xnew.extend(Listbox);
                xnew(ListboxButton);
                xnew((m: xnew.Unit) => {
                    xnew.extend(ListboxMenu, { className: 'panel', style: 'border-radius: 0.5em;' });
                    menu = m.current as HTMLElement;
                    xnew(ListboxItem, { value: 'low' });
                });
            });
        });

        expect(menu.className).toContain('panel');
        expect(menu.getAttribute('style')).toContain('border-radius: 0.5em;');
    });

    it('applies className and style to the Listbox host element', () => {
        const { box } = build({ className: 'boxed', style: 'max-width: 12em;' }, ['low']);

        expect((box.current as HTMLElement).className).toContain('boxed');
        expect((box.current as HTMLElement).getAttribute('style')).toContain('max-width: 12em;');
    });

    it('applies className and style to the ListboxButton trigger', () => {
        let button!: xnew.Unit;
        xnew(() => {
            xnew(() => {
                xnew.extend(Listbox);
                button = xnew(ListboxButton, { className: 'trigger', style: 'border-radius: 9999px;' });
                xnew(() => {
                    xnew.extend(ListboxMenu);
                    xnew(ListboxItem, { value: 'low' });
                });
            });
        });

        expect(triggerOf(button).className).toContain('trigger');
        expect(triggerOf(button).getAttribute('style')).toContain('border-radius: 9999px;');
    });

    it('wears the surface color behind the control on the option list', () => {
        const host = document.createElement('div');
        host.style.backgroundColor = 'rgb(1, 2, 3)';
        document.body.appendChild(host);
        let button!: xnew.Unit;
        let menu!: HTMLElement;
        xnew(host, () => {
            xnew(() => {
                xnew.extend(Listbox);
                button = xnew(ListboxButton);
                xnew((m: xnew.Unit) => {
                    xnew.extend(ListboxMenu);
                    menu = m.current as HTMLElement;
                    xnew(ListboxItem, { value: 'low' });
                    xnew(ListboxItem, { value: 'mid' });
                });
            });
        });

        open(button);
        expect(menu.style.backgroundColor).toBe('rgb(1, 2, 3)');
        host.remove();
    });

    // standalone: `xnew(Listbox, { items })` draws the trigger + option list itself
    it('builds the whole control from items when used standalone', () => {
        let box!: xnew.Unit;
        xnew(() => {
            box = xnew(Listbox, { items: ['low', 'mid', 'high'], value: 'mid' });
        });
        jest.advanceTimersByTime(0);

        const trigger = box.current.firstElementChild as HTMLElement;
        const label = trigger.firstElementChild as HTMLElement;
        // the trigger carries the label plus the default chevron
        expect(label.textContent).toBe('mid');
        expect(trigger.querySelector('svg')).not.toBe(null);

        const received: string[] = [];
        box.on('-change', ({ value }: { value: string }) => received.push(value));

        trigger.dispatchEvent(new Event('click', { bubbles: true }));
        jest.advanceTimersByTime(0);
        const rows = defaultRowsOf(box);
        expect(rows.map((r) => r.textContent)).toEqual(['low', 'mid', 'high']);
        expect(rows.map((r) => r.hasAttribute('data-checked'))).toEqual([false, true, false]);

        rows[2].dispatchEvent(new Event('click', { bubbles: true }));
        expect(received).toEqual(['high']);
        expect(box.value).toBe('high');
        expect(label.textContent).toBe('high');
    });

    it('shows the item label on the trigger and the row, keeping the value underneath', () => {
        let box!: xnew.Unit;
        xnew(() => {
            box = xnew(Listbox, { items: [{ value: 'apple', label: 'りんご' }, { value: 'banana', label: 'ばなな' }] });
        });
        jest.advanceTimersByTime(0);

        const trigger = box.current.firstElementChild as HTMLElement;
        expect(box.value).toBe('apple');
        expect((trigger.firstElementChild as HTMLElement).textContent).toBe('りんご');

        trigger.dispatchEvent(new Event('click', { bubbles: true }));
        jest.advanceTimersByTime(0);
        const rows = defaultRowsOf(box);
        expect(rows.map((r) => r.textContent)).toEqual(['りんご', 'ばなな']);

        rows[1].dispatchEvent(new Event('click', { bubbles: true }));
        expect(box.value).toBe('banana');
        expect((trigger.firstElementChild as HTMLElement).textContent).toBe('ばなな');
    });

    it('leaves the default UI out when the caller composes its own parts', () => {
        const { box } = build({}, ['low', 'mid']);
        jest.advanceTimersByTime(0);

        // only the composed trigger + menu are there: no second trigger, and no default chevron on it
        expect((box.current.firstElementChild as HTMLElement).querySelector('svg')).toBe(null);
    });

    it('closes the option list on a click on the backdrop', () => {
        const { button, menu } = build({}, ['low', 'mid']);

        open(button);
        expect(isOpen(button)).toBe(true);
        backdropOf(menu).dispatchEvent(new MouseEvent('click', { bubbles: true }));
        // data-open clears once the gate reports fully closed
        jest.advanceTimersByTime(300);
        expect(isOpen(button)).toBe(false);
    });

    it('keeps the option list open on a press inside the content', () => {
        const { button, menu } = build({}, ['low', 'mid']);

        open(button);
        rowsOf(menu)[0].dispatchEvent(new Event('pointerdown', { bubbles: true }));
        expect(isOpen(button)).toBe(true);
    });

    it('drives the menu open / close with a shared Gate, animating an Accordion over the same unit', () => {
        let button!: xnew.Unit;
        let accordion!: HTMLElement;
        xnew(() => {
            // the Listbox owns the Gate: the button opens / closes it, the Accordion (after the menu) rides box.gate
            const box = xnew((b: xnew.Unit) => {
                xnew.extend(Listbox, { gate: { open: false, duration: 200 } });
                button = xnew(ListboxButton);
                xnew((m: xnew.Unit) => {
                    xnew.extend(ListboxMenu);
                    xnew.extend(Accordion, { gate: b.gate });
                    accordion = m.current as HTMLElement;
                    xnew(ListboxItem, { value: 'low' });
                    xnew(ListboxItem, { value: 'mid' });
                });
            });
            void box;
        });

        // the gate's deferred initial emit sets the closed state; the Accordion follows it
        jest.advanceTimersByTime(0);
        expect(isOpen(button)).toBe(false);
        expect(accordion.style.opacity).toBe('0');

        // open: data-open flips immediately, the Accordion expands to opacity 1 over the duration
        triggerOf(button).dispatchEvent(new Event('click', { bubbles: true }));
        expect(isOpen(button)).toBe(true);
        jest.advanceTimersByTime(250);
        expect(accordion.style.opacity).toBe('1');

        // close: data-open is held through the collapse (so the trigger's hover tint stays suppressed
        // while the menu is still a hovered descendant), then clears once the gate is fully closed
        triggerOf(button).dispatchEvent(new Event('click', { bubbles: true }));
        expect(isOpen(button)).toBe(true);
        jest.advanceTimersByTime(250);
        expect(accordion.style.opacity).toBe('0');
        expect(isOpen(button)).toBe(false);
    });
});
