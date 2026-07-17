//----------------------------------------------------------------------------------------------------
// InputSelect — listbox pulldown split into InputSelect (framed field) + InputSelectMenu (list) + InputSelectItem (row)
// The native popup cannot be styled, so a framed field toggles a floating list. The field emits
// '-toggle' / '-close'; the menu (optionally driven by a composed Gate) shows / hides in response.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { xicons } from '../../icons/xicons';
import { Design } from '../design';

//----------------------------------------------------------------------------------------------------
// InputSelect — the framed field, the hidden native <select>, and the selection state
//----------------------------------------------------------------------------------------------------

export function InputSelect(unit: xnew.Unit,
    { value, className = '', style = '', designs = {}, ...others }:
    { value?: string, className?: string, style?: string, designs?: { label?: Design }, [key: string]: any } = {}
) {
    const css = xnew.css({
        // the framed field surface; hover tint is suppressed by data-open while the list is open.
        // max-width: stretch sizes the margin box, so any horizontal margin never overflows the parent
        field: {
            layer: 'base',
            block: `
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
            block: `
                flex: 1 1 0; min-width: 0; padding: 0 0.5em;
                white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            `,
        },
    });

    // filled by InputSelectItem.register(); rows persist in the menu, the <option>s back the native value
    const items: { value: string, row: HTMLElement }[] = [];
    const hasInitial = value !== undefined;
    let selected = value ?? '';

    const field = xnew.nest({ tag: 'div', className: `${css.field} ${className}`, style });

    const label = xnew({ tag: 'div', className: `${css.label} ${designs.label?.className ?? ''}`, style: designs.label?.style }, '');

    xnew(xicons.ChevronDown, { style: 'flex: none; width: 0.9em; height: 0.9em; margin-right: 0.5em;' });

    // registered while the current element is the field, so the whole field toggles the list
    unit.on('click', () => xnew.emit('-toggle'));
    // the native input bubbling up from the <select> updates the label and the checked row
    unit.on('input', ({ value }: { value: string }) => {
        label.element.textContent = value;
        for (const item of items) {
            item.row.toggleAttribute('data-checked', item.value === value);
        }
    });

    // nested last, so the unit's element ends on the <select> — a host's unit.on('input') attaches here
    const select = xnew.nest({ tag: 'select', style: 'display: none;', ...others }) as HTMLSelectElement;

    return {
        get value() {
            return select.value;
        },
        // the field element; an InputSelectMenu mounts into it and anchors to it
        get container() {
            return field;
        },
        // called by each InputSelectItem: backs it with a hidden <option> and records the row.
        // the first item claims the default when no initial value was given
        register(itemValue: string, row: HTMLElement) {
            const option = document.createElement('option');
            option.value = itemValue;
            select.appendChild(option);
            items.push({ value: itemValue, row });

            if (!hasInitial && selected === '') {
                selected = itemValue;
            }
            if (itemValue === selected) {
                option.selected = true;
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
        // an InputSelectItem was clicked: set the native value, notify hosts, and close the list
        choose(itemValue: string) {
            select.value = itemValue;
            // fires on the <select> (the unit's element) so a host's unit.on('input') catches it
            select.dispatchEvent(new Event('input', { bubbles: true }));
            xnew.emit('-close');
        },
    };
}

//----------------------------------------------------------------------------------------------------
// InputSelectMenu — the floating option list; mounts into the field and follows the field's '-toggle' /
// '-close'. Compose an Accordion (or bare Gate) onto the same unit and it drives that gate — open / close
// via the unit's merged control surface, hide deferred to '-closed'; without one it shows / hides instantly.
//----------------------------------------------------------------------------------------------------

export function InputSelectMenu(unit: xnew.Unit,
    { className = '', style = '', ...others }:
    { className?: string, style?: string, [key: string]: any } = {}
) {
    const parent = xnew.context(InputSelect);
    const field = parent.container as HTMLElement;

    const css = xnew.css({
        menu: {
            layer: 'base',
            block: `
                position: fixed; margin-top: 0.25em; width: max-content; z-index: 1000;
                max-height: 12em;
                border: 1px solid currentColor;
                overflow-y: auto; scrollbar-width: thin; scrollbar-color: color-mix(in srgb, currentColor 40%, transparent) transparent;
            `,
        },
    });

    // nested last, so the unit's element ends on the menu — InputSelectItem rows nest into it
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
            parent.fill();
            field.toggleAttribute('data-open', true);
            menu.style.display = 'block';
            menu.style.background = surfaceColor();
            anchor();
            // bound to the field so 'outside' means outside the whole control
            session = xnew(field, (list: xnew.Unit) => {
                list.on('pointerdown.outside', () => hide());
                list.on('update', anchor);
            });
            // a composed Gate's control surface (open / close) merges onto this unit; drive it if present
            if (typeof unit.open === 'function') {
                unit.open();
            }
        }
    }

    function hide() {
        if (opened === true) {
            opened = false;
            field.toggleAttribute('data-open', false);
            session?.finalize();
            session = null;
            if (typeof unit.close === 'function') {
                unit.close();
            } else {
                menu.style.display = 'none';
            }
        }
    }

    parent.on('-toggle', () => (opened ? hide() : show()));
    parent.on('-close', () => hide());

    // a composed Gate (e.g. Accordion) hands off the visual: keep the element shown through the close
    // animation, hiding only once the gate reports fully closed. The Gate emits '-closed' on this same
    // unit, so listen here directly (harmless when no Gate is composed — it never fires).
    unit.on('-closed', () => {
        menu.style.display = 'none';
    });

    return {
        // the menu element; InputSelectItem rows mount into it
        get container() {
            return menu;
        },
    };
}

//----------------------------------------------------------------------------------------------------
// InputSelectItem — one option row of an InputSelect; nests into the menu it is created inside.
// Leave the row empty to show the value as text, or nest custom content into it.
//----------------------------------------------------------------------------------------------------

export function InputSelectItem(unit: xnew.Unit,
    { value = '', className = '', style = '', ...others }:
    { value?: string, className?: string, style?: string, [key: string]: any } = {}
) {
    const parent = xnew.context(InputSelect);

    const css = xnew.css({
        item: {
            layer: 'base',
            block: `
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
    parent.register(value, row);

    // registered while the current element is the row, so a click anywhere on it selects the item;
    // stopPropagation keeps the bubble from reaching the field's toggle
    unit.on('click', ({ event }: { event: PointerEvent }) => {
        event.stopPropagation();
        parent.choose(value);
    });
}
