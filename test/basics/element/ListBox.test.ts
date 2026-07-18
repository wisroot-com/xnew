import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';
import { ListBox, ListMenu, ListItem } from '../../../src/basics/element/ListBox';
import { Accordion } from '../../../src/basics/ui/Accordion';
import { Gate } from '../../../src/basics/ui/Gate';

describe('basics ListBox', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        Unit.reset();
    });
    afterEach(() => {
        Unit.engineRoot?.finalize();
        jest.useRealTimers();
    });

    // ListBox is the field (its element ends on the field); a ListMenu nests into it and holds one
    // ListItem row per value. The trailing function is the ExComponent form: xnew(Base, props, inline).
    function build(props: any, values: string[]): { box: xnew.Unit, menu: HTMLElement } {
        let box!: xnew.Unit;
        let menu!: HTMLElement;
        xnew(() => {
            box = xnew(ListBox, props, () => {
                xnew(ListMenu, (m: xnew.Unit) => {
                    menu = m.element as HTMLElement;
                    for (const value of values) {
                        xnew(ListItem, { value });
                    }
                });
            });
        });
        return { box, menu };
    }

    function fieldOf(box: xnew.Unit): HTMLElement {
        return box.element as HTMLElement;
    }

    function labelOf(box: xnew.Unit): HTMLElement {
        return fieldOf(box).firstElementChild as HTMLElement;
    }

    function rowsOf(menu: HTMLElement): HTMLElement[] {
        return Array.from(menu.querySelectorAll(':scope > div')) as HTMLElement[];
    }

    function isOpen(box: xnew.Unit): boolean {
        return fieldOf(box).hasAttribute('data-open');
    }

    function open(box: xnew.Unit): void {
        jest.advanceTimersByTime(0);
        fieldOf(box).dispatchEvent(new Event('click', { bubbles: false }));
        jest.advanceTimersByTime(0);
    }

    it('holds the selection state with the initial value shown in the label', () => {
        const { box } = build({ value: 'mid' }, ['low', 'mid', 'high']);

        expect(box.value).toBe('mid');
        expect(labelOf(box).textContent).toBe('mid');
    });

    it('defaults to the first item', () => {
        const { box } = build({}, ['low', 'mid', 'high']);

        expect(box.value).toBe('low');
        expect(labelOf(box).textContent).toBe('low');
    });

    it('keeps a default width that callers override via style', () => {
        const { box } = build({}, ['low', 'mid']);
        const styleText = [...document.head.querySelectorAll('style')].map((s) => s.textContent).join('\n');

        expect(styleText).toContain('width: 10em;');
        expect(labelOf(box).textContent).toBe('low');
    });

    it('toggles the floating option list on click', () => {
        const { box, menu } = build({}, ['low', 'mid', 'high']);

        expect(menu.style.display).toBe('none');
        open(box);
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

        fieldOf(box).dispatchEvent(new Event('click', { bubbles: false }));
        expect(menu.style.display).toBe('none');
    });

    it('selects an option: updates the label and value, emits -change, and closes', () => {
        const { box, menu } = build({}, ['low', 'mid', 'high']);

        const received: string[] = [];
        box.on('-change', ({ value }: { value: string }) => received.push(value));

        open(box);
        rowsOf(menu)[2].dispatchEvent(new Event('click', { bubbles: true }));

        expect(received).toEqual(['high']);
        expect(box.value).toBe('high');
        expect(labelOf(box).textContent).toBe('high');
        expect(isOpen(box)).toBe(false);
    });

    it('marks the current value with data-checked in the option list', () => {
        const { menu } = build({ value: 'mid' }, ['low', 'mid', 'high']);

        expect(rowsOf(menu).map((r) => r.hasAttribute('data-checked'))).toEqual([false, true, false]);
    });

    it('suppresses the field hover tint via data-open while the option list is open', () => {
        const { box } = build({}, ['low', 'mid']);
        const styleText = [...document.head.querySelectorAll('style')].map((s) => s.textContent).join('\n');
        expect(styleText).toContain('&:not([data-open]):hover { background: color-mix(in srgb, currentColor 20%, transparent); }');

        expect(isOpen(box)).toBe(false);
        open(box);
        expect(isOpen(box)).toBe(true);

        fieldOf(box).dispatchEvent(new Event('click', { bubbles: false }));
        expect(isOpen(box)).toBe(false);
    });

    it('lets each item nest its own row content, falling back to the value text when empty', () => {
        let box!: xnew.Unit;
        let menu!: HTMLElement;
        xnew(() => {
            box = xnew(ListBox, () => {
                xnew(ListMenu, (m: xnew.Unit) => {
                    menu = m.element as HTMLElement;
                    xnew(ListItem, { value: 'plain' });
                    xnew(ListItem, { value: 'rich' }, () => {
                        xnew('<span class="tag">', 'RICH');
                    });
                });
            });
        });

        open(box);
        const rows = rowsOf(menu);
        expect(rows[0].textContent).toBe('plain');
        expect(rows[1].querySelector('.tag')?.textContent).toBe('RICH');
        // the custom row keeps its own content instead of the value fallback
        expect(rows[1].textContent).toBe('RICH');
    });

    it('applies the ListBox label design and ListItem className to the rows', () => {
        let box!: xnew.Unit;
        let menu!: HTMLElement;
        xnew(() => {
            box = xnew(ListBox, { designs: { label: { style: 'font-weight: bold;' } } }, () => {
                xnew(ListMenu, (m: xnew.Unit) => {
                    menu = m.element as HTMLElement;
                    xnew(ListItem, { value: 'low', className: 'row' });
                    xnew(ListItem, { value: 'mid', className: 'row' });
                });
            });
        });

        expect(labelOf(box).getAttribute('style')).toContain('font-weight: bold;');
        expect(rowsOf(menu).every((o) => o.className.includes('row'))).toBe(true);
    });

    it('applies className and style to the ListMenu element', () => {
        let menu!: HTMLElement;
        xnew(() => {
            xnew(ListBox, () => {
                xnew(ListMenu, { className: 'panel', style: 'border-radius: 0.5em;' }, (m: xnew.Unit) => {
                    menu = m.element as HTMLElement;
                    xnew(ListItem, { value: 'low' });
                });
            });
        });

        expect(menu.className).toContain('panel');
        expect(menu.getAttribute('style')).toContain('border-radius: 0.5em;');
    });

    it('applies className and style to the field element', () => {
        const { box } = build({ className: 'boxed', style: 'width: 12em;' }, ['low']);

        expect(fieldOf(box).className).toContain('boxed');
        expect(fieldOf(box).getAttribute('style')).toContain('width: 12em;');
    });

    it('wears the surface color behind the control on the option list', () => {
        const host = document.createElement('div');
        host.style.backgroundColor = 'rgb(1, 2, 3)';
        document.body.appendChild(host);
        let box!: xnew.Unit;
        let menu!: HTMLElement;
        xnew(host, () => {
            box = xnew(ListBox, () => {
                xnew(ListMenu, (m: xnew.Unit) => {
                    menu = m.element as HTMLElement;
                    xnew(ListItem, { value: 'low' });
                    xnew(ListItem, { value: 'mid' });
                });
            });
        });

        open(box);
        expect(menu.style.backgroundColor).toBe('rgb(1, 2, 3)');
        host.remove();
    });

    it('closes the option list on a pointerdown outside the control', () => {
        const { box } = build({}, ['low', 'mid']);

        open(box);
        expect(isOpen(box)).toBe(true);
        document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
        expect(isOpen(box)).toBe(false);
    });

    it('keeps the option list open on a pointerdown inside the control', () => {
        const { box, menu } = build({}, ['low', 'mid']);

        open(box);
        rowsOf(menu)[0].dispatchEvent(new Event('pointerdown', { bubbles: true }));
        expect(isOpen(box)).toBe(true);
    });

    it('drives the menu open / close with a shared Gate, animating an Accordion over the same unit', () => {
        let box!: xnew.Unit;
        let menu!: HTMLElement;
        let accordion!: HTMLElement;
        xnew(() => {
            box = xnew(ListBox, () => {
                // one shared Gate: the menu opens / closes it, the Accordion (after the menu) animates it
                const gate = xnew(Gate, { open: false, duration: 200 });
                xnew(ListMenu, { gate }, (m: xnew.Unit) => {
                    menu = m.element as HTMLElement;
                    xnew.extend(Accordion, { gate });
                    accordion = m.element as HTMLElement;
                    xnew(ListItem, { value: 'low' });
                    xnew(ListItem, { value: 'mid' });
                });
            });
        });

        // the gate's deferred initial emit sets the closed state; the Accordion follows it
        jest.advanceTimersByTime(0);
        expect(menu.style.display).toBe('none');
        expect(accordion.style.opacity).toBe('0');

        // open: the menu shows immediately, the Accordion expands to opacity 1 over the duration
        fieldOf(box).dispatchEvent(new Event('click', { bubbles: false }));
        expect(menu.style.display).toBe('block');
        jest.advanceTimersByTime(250);
        expect(accordion.style.opacity).toBe('1');

        // close: the Accordion collapses; the menu stays shown until the gate reports fully closed
        fieldOf(box).dispatchEvent(new Event('click', { bubbles: false }));
        expect(menu.style.display).toBe('block');
        jest.advanceTimersByTime(250);
        expect(accordion.style.opacity).toBe('0');
        expect(menu.style.display).toBe('none');
    });
});
