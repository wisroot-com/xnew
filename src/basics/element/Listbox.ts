//----------------------------------------------------------------------------------------------------
// Listbox — a styleable select: Listbox (framed field + value) + ListMenu (floating list) + ListItem (row)
// The native <select> popup can't be styled, so selection is held in JS (no native control at all).
// Hosts read the current value with `.value` and observe changes with `.on('-change', ({ value }) => …)`.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { xicons } from '../../icons/xicons';
import { Design } from '../design';

//----------------------------------------------------------------------------------------------------
// Listbox — the framed field, the visible label, and the selection state
//----------------------------------------------------------------------------------------------------

export function Listbox(unit: xnew.Unit,
    { value, className = '', style = '', designs = {}, ...others }:
    { value?: string, className?: string, style?: string, designs?: { label?: Design }, [key: string]: any } = {}
) {
    const css = xnew.css({
        // the framed field surface; hover tint is suppressed by data-open while the list is open.
        // max-width: stretch sizes the margin box, so any horizontal margin never overflows the parent
        field: {
            layer: 'base',
            body: `
                display: inline-flex; align-items: center;
                width: 10em; max-width: -webkit-fill-available; max-width: -moz-available; max-width: stretch; height: 1.8em; margin: 0.125em 0;
                border: 1px solid currentColor; border-radius: 0.25em;
                cursor: pointer; user-select: none;
                &:not([data-open]):hover { background: color-mix(in srgb, currentColor 20%, transparent); }
            `,
        },
        // the visible value fills the width and ellipsizes; the control keeps a default width (like
        // InputText) that callers override via className / style, so no per-item sizing is needed
        label: {
            layer: 'base',
            body: `
                flex: 1 1 0; min-width: 0; padding: 0 0.5em;
                white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            `,
        },
    });

    // filled by ListItem.register(); rows persist in the menu and mark the current value with data-checked
    const items: { value: string, row: HTMLElement }[] = [];
    const hasInitial = value !== undefined;
    let selected = value ?? '';

    // the body stays on the field, so ListMenu / ListItem nest into it and unit.on('click') covers the whole control
    const field = xnew.nest({ tag: 'div', className: `${css.field} ${className}`, style, ...others });

    const label = xnew({ tag: 'div', className: `${css.label} ${designs.label?.className ?? ''}`, style: designs.label?.style }, '');

    xnew(xicons.ChevronDown, { style: 'flex: none; width: 0.9em; height: 0.9em; margin-right: 0.5em;' });

    // clicking anywhere on the field toggles the list (ListItem stops its own click from reaching here)
    unit.on('click', () => xnew.emit('-toggle'));

    return {
        get value() {
            return selected;
        },
        // called by each ListItem: records its row and, if it is the current selection, shows it.
        // the first item claims the default when no initial value was given
        register(itemValue: string, row: HTMLElement) {
            items.push({ value: itemValue, row });
            if (!hasInitial && selected === '') {
                selected = itemValue;
            }
            if (itemValue === selected) {
                label.element.textContent = itemValue;
            }
            row.toggleAttribute('data-checked', itemValue === selected);
        },
        // rows the caller left empty fall back to the value as text (the menu calls this before opening,
        // once every row's custom content has mounted)
        fill() {
            for (const item of items) {
                if (!item.row.hasChildNodes()) {
                    item.row.textContent = item.value;
                }
            }
        },
        // a ListItem was clicked: update the value, notify hosts with '-change', and close the list
        choose(itemValue: string) {
            selected = itemValue;
            label.element.textContent = itemValue;
            for (const item of items) {
                item.row.toggleAttribute('data-checked', item.value === itemValue);
            }
            xnew.emit('-change', { value: itemValue });
            xnew.emit('-close');
        },
    };
}

//----------------------------------------------------------------------------------------------------
// ListMenu — the floating option list; nests into the Listbox field and follows its '-toggle' / '-close'.
// Pass a shared Gate unit (the same one an Accordion animates) and it opens / closes that gate, deferring
// the hide to the gate's '-closed'; without a gate it shows / hides instantly.
//----------------------------------------------------------------------------------------------------

export function ListMenu(unit: xnew.Unit,
    { gate, className = '', style = '', ...others }:
    { gate?: xnew.Unit, className?: string, style?: string, [key: string]: any } = {}
) {
    const box = xnew.context(Listbox);
    const field = box.element as HTMLElement;

    const css = xnew.css({
        menu: {
            layer: 'base',
            body: `
                position: fixed; margin-top: 0.25em; width: max-content; z-index: 1000;
                max-height: 12em;
                border: 1px solid currentColor;
                overflow-y: auto; scrollbar-width: thin; scrollbar-color: color-mix(in srgb, currentColor 40%, transparent) transparent;
            `,
        },
    });

    // nested last, so the unit's element ends on the menu — ListItem rows nest into it
    const menu = xnew.nest({ tag: 'div', className: `${css.menu} ${className}`, style: `display: none; ${style}`, ...others });

    let opened = false;
    let session: xnew.Unit | null = null;

    // the floating list wears the surface color behind the control (the field face is transparent,
    // and reading the field itself would capture its hover tint)
    function surfaceColor() {
        for (let element = field.parentElement; element !== null; element = element.parentElement) {
            const color = getComputedStyle(element).backgroundColor;
            if (color !== '' && color !== 'transparent' && color !== 'rgba(0, 0, 0, 0)') {
                return color;
            }
        }
        return 'Canvas';
    }

    // re-anchored every update tick while open, so scrolling never shifts the list off the field
    function anchor() {
        const rect = field.getBoundingClientRect();
        menu.style.left = `${rect.left}px`;
        menu.style.top = `${rect.bottom}px`;
        menu.style.minWidth = `${rect.width}px`;
    }

    function show() {
        if (opened === false) {
            opened = true;
            box.fill();
            field.toggleAttribute('data-open', true);
            menu.style.display = 'block';
            menu.style.background = surfaceColor();
            anchor();
            // bound to the field so 'outside' means outside the whole control
            session = xnew(field, (list: xnew.Unit) => {
                list.on('pointerdown.outside', () => hide());
                list.on('update', anchor);
            });
            if (gate) {
                gate.open();
            }
        }
    }

    function hide() {
        if (opened === true) {
            opened = false;
            field.toggleAttribute('data-open', false);
            session?.finalize();
            session = null;
            if (gate) {
                gate.close();
            } else {
                menu.style.display = 'none';
            }
        }
    }

    box.on('-toggle', () => (opened ? hide() : show()));
    box.on('-close', () => hide());

    // a shared Gate (e.g. animated by an Accordion) hands off the visual: keep the element shown through
    // the close animation, hiding only once the gate reports fully closed on its own unit.
    gate?.on('-closed', () => {
        menu.style.display = 'none';
    });
}

//----------------------------------------------------------------------------------------------------
// ListItem — one option row of a Listbox; nests into the ListMenu it is created inside.
// Leave the row empty to show the value as text, or nest custom content into it.
//----------------------------------------------------------------------------------------------------

export function ListItem(unit: xnew.Unit,
    { value = '', className = '', style = '', ...others }:
    { value?: string, className?: string, style?: string, [key: string]: any } = {}
) {
    const box = xnew.context(Listbox);

    const css = xnew.css({
        item: {
            layer: 'base',
            body: `
                height: 2em; padding: 0 0.5em;
                display: flex; align-items: center;
                white-space: nowrap;
                cursor: pointer; user-select: none;
                &:hover { background: color-mix(in srgb, currentColor 20%, transparent); }
                &[data-checked] { background: color-mix(in srgb, currentColor 20%, transparent); }
            `,
        },
    });

    const row = xnew.nest({ tag: 'div', className: `${css.item} ${className}`, style, ...others });
    box.register(value, row);

    // registered while the current element is the row, so a click anywhere on it selects the item;
    // stopPropagation keeps the bubble from reaching the field's toggle
    unit.on('click', ({ event }: { event: PointerEvent }) => {
        event.stopPropagation();
        box.choose(value);
    });
}
