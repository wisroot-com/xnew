//----------------------------------------------------------------------------------------------------
// Listbox — a styleable select: Listbox (state) + ListboxButton (trigger) + ListboxMenu (list) + ListboxItem (row)
// The host owns one state, `selected`; the parts own none — they read the rows off the unit tree and repaint on '-select'.
// Standalone it draws the whole control from `items`; composed, the caller nests its own parts instead.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { dispatchCommit, surfaceColor } from '../../utils/dom';
import { ItemDef } from '../../utils/item';
import { Gate } from './Gate';
import { Popover } from './Popover';

//----------------------------------------------------------------------------------------------------
// Listbox — the fit-to-content host (no frame; ListboxButton draws the trigger)
//----------------------------------------------------------------------------------------------------

export function Listbox(unit: xnew.Unit,
    { value, items = [], disabled = false, className = '', style = '', ...others }:
    { value?: string, items?: ItemDef[], disabled?: boolean, className?: string, style?: string, [key: string]: any } = {}
) {
    const css = xnew.css('base', {
        container: `
            display: inline-flex;
            max-width: -webkit-fill-available; max-width: -moz-available; max-width: stretch;
            margin: 0.125em 0;
            &[data-disabled] { opacity: 0.5; cursor: default; pointer-events: none; }
        `,
    });

    const container = xnew.nest({ tag: 'div', className: `${css.container} ${className}`, style, 'data-disabled': disabled === true ? '' : undefined, ...others }) as HTMLElement;

    // the one state; with `items` in hand the pick lands synchronously, so `.value` reads true from tick 0
    const first = items[0];
    let selected = value ?? (first === undefined ? '' : typeof first === 'object' ? first.value : first);

    // the menu's Gate is owned here, never injected: a popup opens at one fixed speed, so callers get no knob to detune it
    const gate = xnew(Gate, { open: false, duration: 200, easing: 'ease' });

    // read off the live unit tree rather than a registry, so nothing has to register and a destroyed row cannot linger
    function rows(): xnew.Unit[] {
        return xnew.find(ListboxItem, { ancestor: unit });
    }

    // '-select' is the internal repaint signal, separate from the public input / change pair that marks a commit
    function apply(value: string) {
        selected = value;
        xnew.emit('-select', { value });
    }

    // once the rows exist, adopt the first as the default when none was given, and repaint either way
    xnew.timeout(() => apply(selected === '' ? rows()[0]?.value ?? '' : selected));

    // the default UI; xnew.standalone runs it after the defines land, which is what lets the parts read them
    xnew.standalone(() => {
        xnew(() => {
            xnew.extend(ListboxButton);
            xnew(ListboxChevron);
        });
        xnew(() => {
            xnew.extend(ListboxMenu);
            for (const item of items) {
                xnew(ListboxItem, typeof item === 'object' ? item : { value: item });
            }
        });
    });

    return {
        get value() {
            return selected;
        },
        // the one write path: a row press and a host assignment are the same act, so both announce and close
        set value(value: string) {
            apply(value);
            dispatchCommit(container, value);
            gate.close();
        },
        // the options as data, read off the rows, so a composed menu describes itself exactly as a standalone one does
        get items(): { value: string, label?: string }[] {
            return rows().map((row) => ({ value: row.value, label: row.label }));
        },
        get gate() {
            return gate;
        },
    };
}

//----------------------------------------------------------------------------------------------------
// ListboxChevron — the default trigger marker; a local svg, so a Listbox never drags the icon table into a bundle
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
// ListboxButton — the framed trigger: draws the border / label and toggles the Listbox gate on click
//----------------------------------------------------------------------------------------------------

export function ListboxButton(unit: xnew.Unit,
    { className = '', style = '', ...others }:
    { className?: string, style?: string, [key: string]: any } = {}
) {
    const listbox = xnew.context(Listbox);

    const css = xnew.css('base', {
        container: `
            display: inline-flex; align-items: center;
            width: 10em; max-width: -webkit-fill-available; max-width: -moz-available; max-width: stretch; height: 1.8em;
            padding: 0 0.5em;
            border: 1px solid currentColor; border-radius: 0.25em;
            cursor: pointer; user-select: none;
            &:not([data-open]):hover { background: color-mix(in srgb, currentColor 10%, transparent); }
            &:focus-visible, &:has(:focus-visible) { outline: 2px solid currentColor; outline-offset: 1px; }
        `,
        label: `
            flex: 1 1 0; min-width: 0;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        `,
    });

    xnew.nest({ tag: 'div', className: `${css.container} ${className}`, style, ...others });
    const label = xnew({ tag: 'div', className: css.label });

    // the trigger resolves its own text from the host's options, so the host keeps no list of labels to push into
    function write() {
        label.current.textContent = listbox.items.find((item: { value: string }) => item.value === listbox.value)?.label ?? listbox.value;
    }
    write();
    listbox.on('-select', write);

    // stop the opening click from bubbling to the document, or ListboxMenu's click.outside would self-close it
    unit.on('click', ({ event }: { event: PointerEvent }) => {
        event.stopPropagation();
        listbox.gate.toggle();
    });
    listbox.gate.on('-open', () => unit.current.toggleAttribute('data-open', true));
    listbox.gate.on('-closed', () => unit.current.toggleAttribute('data-open', false));
}

//----------------------------------------------------------------------------------------------------
// ListboxMenu — the floating option list, built on Popover and riding the Gate the Listbox owns
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

    xnew.extend(Popover, { gate: listbox.gate, anchor: listbox.current });

    xnew.nest({ tag: 'div', className: `${css.container} ${className}`, style, ...others }) as HTMLElement;

    // registered right after nesting the menu, so the press that opened it cannot self-close it
    unit.on('click.outside', () => {
        const state = listbox.gate.state;
        if (state === 'opened' || state === 'opening') {
            listbox.gate.close();
        }
    });

    // opaque only once open: a floating list has to hide what it covers
    listbox.gate.on('-open', () => unit.current.style.background = surfaceColor(listbox.current));
}

//----------------------------------------------------------------------------------------------------
// ListboxItem — one option row; a trailing text / function supplies its content, empty falls back to `label` / the value
//----------------------------------------------------------------------------------------------------

export function ListboxItem(unit: xnew.Unit,
    { value = '', label, className = '', style = '', ...others }:
    { value?: string, label?: string, className?: string, style?: string, [key: string]: any } = {}
) {
    const listbox = xnew.context(Listbox);

    const css = xnew.css('base', {
        container: `
            height: 2em; padding: 0 0.5em;
            display: flex; align-items: center;
            white-space: nowrap;
            cursor: pointer; user-select: none;
            &:hover { background: color-mix(in srgb, currentColor 10%, transparent); }
            &[data-checked] { background: color-mix(in srgb, currentColor 20%, transparent); }
            &[data-checked]:hover { background: color-mix(in srgb, currentColor 30%, transparent); }
        `,
    });
    xnew.nest({ tag: 'div', className: `${css.container} ${className}`, style, ...others });

    // each row tints itself off the host's pick, so the host needs no registry of rows to push state into
    function paint() {
        unit.current.toggleAttribute('data-checked', listbox.value === value);
    }
    paint();
    listbox.on('-select', paint);

    unit.on('click', ({ event }: { event: PointerEvent }) => {
        event.stopPropagation();
        listbox.value = value;
    });

    // fall back to the label (or the value) as text when nothing is composed into the row
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
    };
}
