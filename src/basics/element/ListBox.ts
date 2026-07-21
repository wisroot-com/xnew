//----------------------------------------------------------------------------------------------------
// ListBox — a styleable select: ListBox (state + fit-to-content host) + ListBoxButton (framed trigger + label) + ListBoxMenu (floating list) + ListBoxItem (row)
// The native <select> popup can't be styled, so selection is held in JS (no native control at all).
// Hosts read the current value with `.value` and observe changes with `.on('-change', ({ value }) => …)`.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { Gate } from '../ui/Gate';
import { Overlay } from '../ui/Overlay';

//----------------------------------------------------------------------------------------------------
// ListBox — the selection state and the fit-to-content host (no frame; ListBoxButton draws the trigger)
//----------------------------------------------------------------------------------------------------

export function ListBox(unit: xnew.Unit,
    { value, gate, className = '', style = '', ...others }:
    { value?: string, gate?: { open?: boolean, duration?: number, easing?: string } | xnew.Unit, className?: string, style?: string, [key: string]: any } = {}
) {
    const css = xnew.css('base', {
        container: `
            display: inline-flex;
            max-width: -webkit-fill-available; max-width: -moz-available; max-width: stretch;
            margin: 0.125em 0;
        `,
    });

    let selected = value ?? '';
    xnew.nest({ tag: 'div', className: `${css.container} ${className}`, style, ...others });

    const items: xnew.Unit[] = [];
    const labels: HTMLElement[] = [];

    gate = xnew.isUnit(gate) ? gate : xnew(Gate, gate ?? { open: false, duration: 0 });

    function apply(value: string) {
        selected = value;
        for (const label of labels) {
            label.textContent = selected;
        }
        for (const item of items) {
            item.check(item.value === selected);
        }
    }

    // once every item has registered, adopt the first as the default when none was given, and sync checked state either way
    xnew.timeout(() => apply(selected === '' && items.length > 0 ? items[0].value : selected));

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
        bind(label: HTMLElement) {
            labels.push(label);
            label.textContent = selected;
        },
        select(value: string) {
            apply(value);
            xnew.emit('-change', { value });
            gate.close();
        },
    };
}

//----------------------------------------------------------------------------------------------------
// ListBoxButton — the framed trigger: draws the border / label, toggles the ListBox gate on click.
// Compose extra content (e.g. a chevron icon) with a trailing function; the label reflects the value.
//----------------------------------------------------------------------------------------------------

export function ListBoxButton(unit: xnew.Unit,
    { className = '', style = '', ...others }:
    { className?: string, style?: string, [key: string]: any } = {}
) {
    const listbox = xnew.context(ListBox);

    const css = xnew.css('base', {
        container: `
            display: inline-flex; align-items: center;
            width: 10em; max-width: 100%; height: 1.8em;
            padding: 0 0.5em;
            border: 1px solid currentColor; border-radius: 0.25em;
            cursor: pointer; user-select: none;
            &:not([data-open]):hover { background: color-mix(in srgb, currentColor 20%, transparent); }
        `,
        label: `
            flex: 1 1 0; min-width: 0;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        `,
    });

    xnew.nest({ tag: 'div', className: `${css.container} ${className}`, style, ...others });
    const label = xnew({ tag: 'div', className: css.label });
    listbox.bind(label.element);

    // stop the opening click from bubbling to the document, or ListBoxMenu's click.outside would self-close it
    unit.on('click', ({ event }: { event: PointerEvent }) => {
        event.stopPropagation();
        listbox.gate.toggle();
    });
    listbox.gate.on('-open', () => unit.element.toggleAttribute('data-open', true));
    listbox.gate.on('-closed', () => unit.element.toggleAttribute('data-open', false));
}

//----------------------------------------------------------------------------------------------------
// ListBoxMenu — the floating option list, built on Overlay (backdrop + anchor tracking + outside-click + fade).
// Follows the ListBox container's '-toggle' / '-close'; rides the Gate the ListBox owns (`listbox.gate`).
//----------------------------------------------------------------------------------------------------

export function ListBoxMenu(unit: xnew.Unit,
    { className = '', style = '', ...others }:
    { className?: string, style?: string, [key: string]: any } = {}
) {
    const listbox = xnew.context(ListBox);

    const css = xnew.css('base', {
        container: `
            position: absolute; top: 100%; left: 0; margin-top: 0.25em;
            min-width: 100%; width: max-content; max-height: 12em;
            border: 1px solid currentColor; border-radius: 0.25em;
            overflow-y: auto; scrollbar-width: thin; scrollbar-color: color-mix(in srgb, currentColor 40%, transparent) transparent;
        `,
    });

    xnew.extend(Overlay, { gate: listbox.gate, anchor: listbox.element });

    xnew.nest({ tag: 'div', className: `${css.container} ${className}`, style, ...others }) as HTMLElement;

    // one outside-press closer for the whole list (registered right after nesting the menu, so the press
    // that opened it can't self-close it); a press on a row stays inside the menu and is handled by the item
    unit.on('click.outside', () => {
        const state = listbox.gate.state;
        if (state === 'opened' || state === 'opening') {
            listbox.gate.close();
        }
    });

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
// ListBoxItem — one option row of a ListBox; nests into the ListBoxMenu it is created inside.
// Pass row content as a trailing text (xnew(ListBoxItem, { value }, 'label')) or an inline function;
// leave it empty to fall back to the value as text.
//----------------------------------------------------------------------------------------------------

export function ListBoxItem(unit: xnew.Unit,
    { value = '', className = '', style = '', ...others }:
    { value?: string, className?: string, style?: string, [key: string]: any } = {}
) {
    const listbox = xnew.context(ListBox);
    listbox.register(unit);

    const css = xnew.css('base', {
        container: `
            height: 2em; padding: 0 0.5em;
            display: flex; align-items: center;
            white-space: nowrap;
            cursor: pointer; user-select: none;
            &:hover { background: color-mix(in srgb, currentColor 20%, transparent); }
            &[data-checked] { background: color-mix(in srgb, currentColor 20%, transparent); }
        `,
    });
    xnew.nest({ tag: 'div', className: `${css.container} ${className}`, style, ...others });

    unit.on('click', ({ event }: { event: PointerEvent }) => {
        event.stopPropagation();
        listbox.select(value);
    });
    // fall back to the value as text when the row is used standalone (no content composed into it)
    if (xnew.standalone === true) {
        unit.element.textContent = value;
    }

    return {
        get value() {
            return value;
        },
        check(current: boolean) {
            unit.element.toggleAttribute('data-checked', current);
        },
    };
}
