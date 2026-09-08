//----------------------------------------------------------------------------------------------------
// Listbox — a styleable select: Listbox (state + fit-to-content host) + ListboxButton (framed trigger + label) + ListboxMenu (floating list) + ListboxItem (row)
// The native <select> popup can't be styled, so selection is held in JS (no native control at all).
// Standalone, `xnew(Listbox, { items })` draws the whole control; a trailing compose fn replaces that
// default with hand-built parts (xnew.standalone gate). `.value` is the single read / write path — a row press
// and a host assignment both go through its setter, which fires the native `input` + `change` pair
// (a selection settles at once, as on a native <select>) and closes the menu.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { dispatchCommit } from '../../utils/dom';
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
    { value, items = [], duration = 0, easing = 'ease', className = '', style = '', ...others }:
    { value?: string, items?: ItemDef[], duration?: number, easing?: string, className?: string, style?: string, [key: string]: any } = {}
) {
    const css = xnew.css('base', {
        container: `
            display: inline-flex;
            max-width: -webkit-fill-available; max-width: -moz-available; max-width: stretch;
            margin: 0.125em 0;
        `,
    });

    const container = xnew.nest({ tag: 'div', className: `${css.container} ${className}`, style, ...others }) as HTMLElement;

    // `items` is known right here, so the default lands synchronously and `.value` reads true from tick 0;
    // the composed path (the caller builds the rows) has none, and falls back to the deferred adoption below
    let selected = value ?? (items.length > 0 ? itemDef(items[0]).value : '');

    const rows: xnew.Unit[] = [];
    const labels: xnew.Unit[] = [];

    // the menu's Gate is owned here, never injected: the button toggles it and the setter closes it, so its closed start is fixed
    const gate = xnew(Gate, { open: false, duration, easing });

    // the trigger shows the selected row's label, falling back to the value itself when it has none
    function text(value: string): string {
        return rows.find((row) => row.value === value)?.label ?? value;
    }

    function apply(value: string) {
        selected = value;
        for (const label of labels) {
            label.current.textContent = text(selected);
        }
        for (const row of rows) {
            row.check(row.value === selected);
        }
    }

    // once every row has registered, adopt the first as the default when none was given, and sync checked state either way
    xnew.timeout(() => apply(selected === '' && rows.length > 0 ? rows[0].value : selected));

    // default trigger + option list, drawn only when standalone so a caller can compose its own instead;
    // xnew.standalone runs it after the defines below are on the unit, which is what lets the parts
    // reach `.gate` / `.register` / `.bind` from their own bodies
    xnew.standalone(() => {
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
    });

    return {
        get value() {
            return selected;
        },
        // the one write path: a row press and a host assignment are the same act, so both announce and close
        // (the deferred default adoption above calls `apply` directly, so it stays silent)
        set value(value: string) {
            apply(value);
            dispatchCommit(container, value);
            gate.close();
        },
        get gate() {
            return gate;
        },
        // both registries drop their entry when the part is destroyed, so a rebuilt menu leaves no stale unit behind
        register(row: xnew.Unit) {
            rows.push(row);
            row.on('destroy', () => rows.splice(rows.indexOf(row), 1));
        },
        bind(label: xnew.Unit) {
            labels.push(label);
            label.on('destroy', () => labels.splice(labels.indexOf(label), 1));
            label.current.textContent = text(selected);
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
    listbox.bind(label);

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
        listbox.value = value;
    });
    // fall back to the label (or the value) as text when the row is used standalone (no content composed into it)
    xnew.standalone(() => {
        unit.current.textContent = label ?? value;
    });

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
