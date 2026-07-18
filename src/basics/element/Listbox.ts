//----------------------------------------------------------------------------------------------------
// Listbox — a styleable select: Listbox (framed container + value) + ListboxMenu (floating list) + ListboxItem (row)
// The native <select> popup can't be styled, so selection is held in JS (no native control at all).
// Hosts read the current value with `.value` and observe changes with `.on('-change', ({ value }) => …)`.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { Gate } from '../ui/Gate';
import { Overlay } from '../ui/Overlay';

//----------------------------------------------------------------------------------------------------
// Listbox — the framed container, the visible label, and the selection state
//----------------------------------------------------------------------------------------------------

export function Listbox(unit: xnew.Unit,
    { value, gate, className = '', style = '', ...others }:
    { value?: string, gate?: { open?: boolean, duration?: number, easing?: string } | xnew.Unit, className?: string, style?: string, [key: string]: any } = {}
) {
    const css = xnew.css({
        container: {
            layer: 'base',
            body: `
                display: inline-flex; align-items: center;
                width: 10em; max-width: -webkit-fill-available; max-width: -moz-available; max-width: stretch; height: 1.8em;
                margin: 0.125em 0; padding: 0 0.5em;
                border: 1px solid currentColor; border-radius: 0.25em;
                cursor: pointer; user-select: none;
                &:not([data-open]):hover { background: color-mix(in srgb, currentColor 20%, transparent); }
            `,
        },
        label: {
            layer: 'base',
            body: `
                flex: 1 1 0; min-width: 0;
                white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            `,
        },
    });

    let selected = value ?? '';
    xnew.nest({ tag: 'div', className: `${css.container} ${className}`, style, ...others });
    const label = xnew({ tag: 'div', className: css.label }, selected);

    const items: xnew.Unit[] = [];

    gate = gate instanceof xnew.Unit ? gate : xnew(Gate, gate ?? { open: false, duration: 0 });

    unit.on('click', () => gate.toggle());
    gate.on('-open', () => unit.element.toggleAttribute('data-open', true));
    gate.on('-closed', () => unit.element.toggleAttribute('data-open', false));

    function apply(value: string) {
        label.element.textContent = selected = value;
        for (const item of items) {
            item.check(item.value === selected);
        }
    }

    xnew.timeout(() => selected === '' && items.length > 0 && apply(items[0].value));

    return {
        get value() {
            return selected;
        },
        get gate() {
            return gate;
        },
        register(item: xnew.Unit) {
            items.push(item);
        },
        select(value: string) {
            apply(value);
            xnew.emit('-select', { value });
            gate.close();
        },
    };
}

//----------------------------------------------------------------------------------------------------
// ListboxMenu — the floating option list, built on Overlay (backdrop + anchor tracking + outside-click + fade).
// Follows the Listbox container's '-toggle' / '-close'; rides the Gate the Listbox owns (`listbox.gate`).
//----------------------------------------------------------------------------------------------------

export function ListboxMenu(unit: xnew.Unit,
    { className = '', style = '', ...others }:
    { className?: string, style?: string, [key: string]: any } = {}
) {
    const listbox = xnew.context(Listbox);

    const css = xnew.css({
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

    xnew.extend(Overlay, { gate: listbox.gate, anchor: listbox.element });

    xnew.nest({ tag: 'div', className: `${css.menu} ${className}`, style, ...others }) as HTMLElement;

    listbox.gate.on('-open', () => unit.element.style.background = surfaceColor());

    function surfaceColor() {
        for (let element = listbox.element.parentElement; element !== null; element = element.parentElement) {
            const color = getComputedStyle(element).backgroundColor;
            if (color !== '' && color !== 'transparent' && color !== 'rgba(0, 0, 0, 0)') {
                return color;
            }
        }
        return 'Canvas';
    }
}

//----------------------------------------------------------------------------------------------------
// ListboxItem — one option row of a Listbox; nests into the ListboxMenu it is created inside.
// Pass row content as a trailing text (xnew(ListboxItem, { value }, 'label')) or an inline function;
// leave it empty to fall back to the value as text (filled one tick after creation).
//----------------------------------------------------------------------------------------------------

export function ListboxItem(unit: xnew.Unit,
    { value = '', className = '', style = '', ...others }:
    { value?: string, className?: string, style?: string, [key: string]: any } = {}
) {
    const listbox = xnew.context(Listbox);
    listbox.register(unit);

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
    xnew.nest({ tag: 'div', className: `${css.item} ${className}`, style, ...others });

    unit.on('click', ({ event }: { event: PointerEvent }) => {
        event.stopPropagation();
        listbox.select(value);
    });
    unit.on('click.outside', () => {
        if (listbox.gate.state === 'opened') {
            listbox.gate.close();
        }
    });
    // a trailing text / inline function mounts the row's content after this body, so fall back to the
    // value as text one tick later, only when the caller left the row empty
    xnew.timeout(() => {
        if (unit.element.hasChildNodes() === false) {
            unit.element.textContent = value;
        }
    });

    return {
        get value() {
            return value;
        },
        check(current: boolean) {
            unit.element.toggleAttribute('data-checked', current);
        },
    };
}
