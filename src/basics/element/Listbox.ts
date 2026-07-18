//----------------------------------------------------------------------------------------------------
// Listbox — a styleable select: Listbox (framed container + value) + ListboxMenu (floating list) + ListboxItem (row)
// The native <select> popup can't be styled, so selection is held in JS (no native control at all).
// Hosts read the current value with `.value` and observe changes with `.on('-change', ({ value }) => …)`.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { xicons } from '../../icons/xicons';
import { Overlay } from '../ui/Overlay';
import { Design } from '../design';

//----------------------------------------------------------------------------------------------------
// Listbox — the framed container, the visible label, and the selection state
//----------------------------------------------------------------------------------------------------

export function Listbox(unit: xnew.Unit,
    { value, className = '', style = '', designs = {}, ...others }:
    { value?: string, className?: string, style?: string, designs?: { label?: Design }, [key: string]: any } = {}
) {
    const css = xnew.css({
        // the framed container surface; hover tint is suppressed by data-open while the list is open.
        // max-width: stretch sizes the margin box, so any horizontal margin never overflows the parent
        container: {
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

    // filled by ListboxItem.register(); rows persist in the menu and mark the current value with data-checked
    const items: { value: string, row: HTMLElement }[] = [];
    const hasInitial = value !== undefined;
    let selected = value ?? '';

    // the body stays on the container, so ListboxMenu / ListboxItem nest into it and unit.on('click') covers the whole control
    xnew.nest({ tag: 'div', className: `${css.container} ${className}`, style, ...others });

    const label = xnew({ tag: 'div', className: `${css.label} ${designs.label?.className ?? ''}`, style: designs.label?.style }, '');

    xnew(xicons.ChevronDown, { style: 'flex: none; width: 0.9em; height: 0.9em; margin-right: 0.5em;' });

    // clicking anywhere on the container toggles the list (ListboxItem stops its own click from reaching here)
    unit.on('click', () => xnew.emit('-toggle'));

    // reflect `selected` onto the view: the label text and each row's data-checked
    function apply() {
        label.element.textContent = selected;
        for (const item of items) {
            item.row.toggleAttribute('data-checked', item.value === selected);
        }
    }

    return {
        get value() {
            return selected;
        },
        // called by each ListboxItem: records its row and reflects the current selection.
        // the first item claims the default when no initial value was given
        register(itemValue: string, row: HTMLElement) {
            items.push({ value: itemValue, row });
            if (!hasInitial && selected === '') {
                selected = itemValue;
            }
            apply();
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
        // a ListboxItem was clicked: update the value, notify hosts with '-change', and close the list
        choose(itemValue: string) {
            selected = itemValue;
            apply();
            xnew.emit('-change', { value: itemValue });
            xnew.emit('-close');
        },
    };
}

//----------------------------------------------------------------------------------------------------
// ListboxMenu — the floating option list, built on Overlay (backdrop + anchor tracking + outside-click + fade).
// Follows the Listbox container's '-toggle' / '-close'; reuses a shared Gate (e.g. an Accordion's) or makes its own.
//----------------------------------------------------------------------------------------------------

export function ListboxMenu(_unit: xnew.Unit,
    { gate, className = '', style = '', ...others }:
    { gate?: xnew.Unit, className?: string, style?: string, [key: string]: any } = {}
) {
    const box = xnew.context(Listbox);
    const container = box.element as HTMLElement;

    const css = xnew.css({
        // hangs under Overlay's anchor-tracking box (the container's rect), so top: 100% lands it at the container's foot
        menu: {
            layer: 'base',
            body: `
                position: absolute; top: 100%; left: 0; margin-top: 0.25em;
                min-width: 100%; width: max-content; max-height: 12em;
                border: 1px solid currentColor;
                overflow-y: auto; scrollbar-width: thin; scrollbar-color: color-mix(in srgb, currentColor 40%, transparent) transparent;
            `,
        },
    });

    // Overlay owns the backdrop, the container-rect tracking, the outside-click close and the fade; its
    // anchor box becomes the positioned parent the menu hangs under. A caller Gate (shared with an
    // Accordion) is reused; otherwise Overlay makes its own — instant (duration 0), starting closed.
    const overlay = xnew.extend(Overlay, { gate: gate ?? { open: false, duration: 0 }, anchor: container });

    // element now ends on Overlay's anchor box; nest the list into it so ListboxItem rows nest into the list
    const menu = xnew.nest({ tag: 'div', className: `${css.menu} ${className}`, style, ...others }) as HTMLElement;

    let opened = false;

    // the floating list wears the surface color behind the control (the container face is transparent,
    // and reading the container itself would capture its hover tint)
    function surfaceColor() {
        for (let element = container.parentElement; element !== null; element = element.parentElement) {
            const color = getComputedStyle(element).backgroundColor;
            if (color !== '' && color !== 'transparent' && color !== 'rgba(0, 0, 0, 0)') {
                return color;
            }
        }
        return 'Canvas';
    }

    function show() {
        if (opened === false) {
            opened = true;
            box.fill();
            // data-open suppresses the container's hover tint while the list is up
            container.toggleAttribute('data-open', true);
            menu.style.background = surfaceColor();
            overlay.gate.open();
        }
    }

    function hide() {
        if (opened === true) {
            opened = false;
            overlay.gate.close();
        }
    }

    box.on('-toggle', () => (opened ? hide() : show()));
    box.on('-close', () => hide());

    // drop data-open only once the gate is fully closed (this also covers Overlay's outside-click close,
    // which calls the gate directly): keeping it through the fade-out leaves the menu a hovered descendant
    // of the container, so removing it early would flash the container's hover tint until the menu vanishes
    overlay.gate.on('-closed', () => {
        opened = false;
        container.toggleAttribute('data-open', false);
    });
}

//----------------------------------------------------------------------------------------------------
// ListboxItem — one option row of a Listbox; nests into the ListboxMenu it is created inside.
// Pass row content as a trailing text (xnew(ListboxItem, { value }, 'label')) or an inline function;
// leave it empty to fall back to the value as text (filled by Listbox.fill() on open).
//----------------------------------------------------------------------------------------------------

export function ListboxItem(unit: xnew.Unit,
    { value = '', className = '', style = '', ...others }:
    { value?: string, className?: string, style?: string, [key: string]: any } = {}
) {
    const listbox = xnew.context(Listbox);

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
    listbox.register(value, row);

    // registered while the current element is the row, so a click anywhere on it selects the item;
    // stopPropagation keeps the bubble from reaching the container's toggle
    unit.on('click', ({ event }: { event: PointerEvent }) => {
        event.stopPropagation();
        listbox.choose(value);
    });
}
