//----------------------------------------------------------------------------------------------------
// Listbox — a styleable select: Listbox (state + fit-to-content host) + ListboxButton (framed trigger + label) + ListboxMenu (floating list) + ListboxItem (row)
// The native <select> popup can't be styled, so selection is held in JS (no native control at all).
// Standalone, `xnew(Listbox, { items })` draws the whole control; a trailing compose fn replaces that
// default with hand-built parts (xnew.standalone gate). `.value` reads it, `-change` reports edits.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { Gate } from '../widget/Gate';
import { Overlay } from '../widget/Overlay';

//----------------------------------------------------------------------------------------------------
// Listbox — the fit-to-content host (no frame; ListboxButton draws the trigger)
// Standalone it builds the default trigger + option list out of `items`; composed, the caller nests its own.
//----------------------------------------------------------------------------------------------------

// a row / tab is either the bare value, or a value with its own display label (shared with Panel)
export type ItemDef<T = string> = T | { value: T, label?: string };

// normalizes both forms to { value, label }, so callers only ever branch here
export function itemDef<T>(item: ItemDef<T>): { value: T, label?: string } {
    return (item !== null && typeof item === 'object' && 'value' in (item as object)) ? item as { value: T, label?: string } : { value: item as T };
}

export function Listbox(unit: xnew.Unit,
    { value, items = [], gate, className = '', style = '', ...others }:
    { value?: string, items?: ItemDef[], gate?: { open?: boolean, duration?: number, easing?: string } | xnew.Unit, className?: string, style?: string, [key: string]: any } = {}
) {
    const css = xnew.css('base', {
        container: `
            display: inline-flex;
            max-width: -webkit-fill-available; max-width: -moz-available; max-width: stretch;
            margin: 0.125em 0;
        `,
    });

    xnew.nest({ tag: 'div', className: `${css.container} ${className}`, style, ...others });

    // a component's defines land on the unit only after it returns, so the state goes on first through its
    // own component — that is what lets the default UI below already reach `.gate` / `.register` / `.bind`
    xnew.extend(ListboxState, { value, gate });

    // default trigger + option list, drawn only when standalone so a caller can compose its own instead
    if (xnew.standalone === true) {
        xnew(() => {
            xnew.extend(ListboxButton);
            xnew(ListboxChevron);
        });
        xnew(() => {
            xnew.extend(ListboxMenu);
            for (const item of items) {
                xnew(ListboxItem, itemDef(item));
            }
        });
    }
}

//----------------------------------------------------------------------------------------------------
// ListboxState — the selection state itself: the value, the shared Gate, and the item / label registries
//----------------------------------------------------------------------------------------------------

function ListboxState(unit: xnew.Unit,
    { value, gate }:
    { value?: string, gate?: { open?: boolean, duration?: number, easing?: string } | xnew.Unit } = {}
) {
    let selected = value ?? '';

    const items: xnew.Unit[] = [];
    const labels: HTMLElement[] = [];

    gate = xnew.isUnit(gate) ? gate : xnew(Gate, gate ?? { open: false, duration: 0 });

    // the trigger shows the selected row's label, falling back to the value itself when it has none
    function text(value: string): string {
        return items.find((item) => item.value === value)?.label ?? value;
    }

    function apply(value: string) {
        selected = value;
        for (const label of labels) {
            label.textContent = text(selected);
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
            label.textContent = text(selected);
        },
        select(value: string) {
            apply(value);
            xnew.emit('-change', { value });
            gate.close();
        },
    };
}

//----------------------------------------------------------------------------------------------------
// ListboxChevron — the default trigger marker drawn beside the label when the Listbox builds its own UI
// (a local svg rather than xicons, so using a Listbox never drags the whole icon table into a bundle)
//----------------------------------------------------------------------------------------------------

function ListboxChevron() {
    const css = xnew.css('base', {
        container: `
            flex: none; width: 0.9em; height: 0.9em; margin-left: 0.25em;
            fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round;
        `,
    });

    xnew.nest({ tag: 'svg', viewBox: '0 0 12 12', className: css.container });
    xnew('<path d="M2.5 4.5 6 8 9.5 4.5"/>');
}

//----------------------------------------------------------------------------------------------------
// ListboxButton — the framed trigger: draws the border / label, toggles the Listbox gate on click (compose extra content with a trailing function)
//----------------------------------------------------------------------------------------------------

export function ListboxButton(unit: xnew.Unit,
    { className = '', style = '', ...others }:
    { className?: string, style?: string, [key: string]: any } = {}
) {
    const listbox = xnew.context(Listbox);

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
    listbox.bind(label.current);

    // stop the opening click from bubbling to the document, or ListboxMenu's click.outside would self-close it
    unit.on('click', ({ event }: { event: PointerEvent }) => {
        event.stopPropagation();
        listbox.gate.toggle();
    });
    listbox.gate.on('-open', () => unit.current.toggleAttribute('data-open', true));
    listbox.gate.on('-closed', () => unit.current.toggleAttribute('data-open', false));
}

//----------------------------------------------------------------------------------------------------
// ListboxMenu — the floating option list, built on Overlay and riding the Gate the Listbox owns (`listbox.gate`)
//----------------------------------------------------------------------------------------------------

export function ListboxMenu(unit: xnew.Unit,
    { className = '', style = '', ...others }:
    { className?: string, style?: string, [key: string]: any } = {}
) {
    const listbox = xnew.context(Listbox);

    const css = xnew.css('base', {
        container: `
            position: absolute; top: 100%; left: 0; margin-top: 0.25em;
            min-width: 100%; width: max-content; max-height: 12em;
            border: 1px solid currentColor; border-radius: 0.25em;
            overflow-y: auto; scrollbar-width: thin; scrollbar-color: color-mix(in srgb, currentColor 40%, transparent) transparent;
        `,
    });

    xnew.extend(Overlay, { gate: listbox.gate, anchor: listbox.current });

    xnew.nest({ tag: 'div', className: `${css.container} ${className}`, style, ...others }) as HTMLElement;

    // one outside-press closer for the whole list, registered right after nesting the menu so the opening press can't self-close it
    unit.on('click.outside', () => {
        const state = listbox.gate.state;
        if (state === 'opened' || state === 'opening') {
            listbox.gate.close();
        }
    });

    listbox.gate.on('-open', () => unit.current.style.background = surfaceColor());

    function surfaceColor() {
        for (let element = listbox.current.parentElement; element !== null; element = element.parentElement) {
            const color = getComputedStyle(element).backgroundColor;
            if (color !== '' && color !== 'transparent' && color !== 'rgba(0, 0, 0, 0)') {
            return color;
            }
        }
        return 'Canvas';
    }
}

//----------------------------------------------------------------------------------------------------
// ListboxItem — one option row of a Listbox; a trailing text / function supplies the row content, empty falls back to `label` / the value
//----------------------------------------------------------------------------------------------------

export function ListboxItem(unit: xnew.Unit,
    { value = '', label, className = '', style = '', ...others }:
    { value?: string, label?: string, className?: string, style?: string, [key: string]: any } = {}
) {
    const listbox = xnew.context(Listbox);
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
    // fall back to the label (or the value) as text when the row is used standalone (no content composed into it)
    if (xnew.standalone === true) {
        unit.current.textContent = label ?? value;
    }

    return {
        get value() {
            return value;
        },
        get label() {
            return label;
        },
        check(current: boolean) {
            unit.current.toggleAttribute('data-checked', current);
        },
    };
}
