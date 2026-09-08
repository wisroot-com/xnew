//----------------------------------------------------------------------------------------------------
// InputRadio — an exclusive radio segment (a <label> wrapping a hidden native <input type="radio">) and
// InputRadioGroup, the frame that owns the shared name and the pick as its `.value`
// A segment still works alone (pass `name` yourself, read the pick off `.checked`); grouped, the group announces.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { dispatchCommit } from '../../utils/dom';
import { ItemDef, itemDef } from './Listbox';

//----------------------------------------------------------------------------------------------------
// InputRadioGroup — the framed segment strip; `.value` is the single read / write path for the pick
// Standalone it draws one segment per `items`; composed, the caller nests its own InputRadios.
//----------------------------------------------------------------------------------------------------

// radios group by a shared `name` and an empty one groups nothing, so every group falls back to its own
let serial = 0;

export function InputRadioGroup(unit: xnew.Unit,
    { value, items = [], name, disabled = false, className = '', style = '', ...others }:
    { value?: string, items?: ItemDef[], name?: string, disabled?: boolean, className?: string, style?: string, [key: string]: any } = {}
) {
    const css = xnew.css('base', {
        container: `
            display: inline-flex; align-items: stretch;
            max-width: -webkit-fill-available; max-width: -moz-available; max-width: stretch; min-height: 1.8em;
            margin: 0.125em 0;
            border: 1px solid currentColor; border-radius: 0.25em;
            overflow: hidden;
            &[data-disabled] { opacity: 0.5; cursor: default; pointer-events: none; }
        `,
    });

    const container = xnew.nest({ tag: 'div', className: `${css.container} ${className}`, style, 'data-disabled': disabled === true ? '' : undefined, ...others }) as HTMLElement;

    const shared = name ?? `xnew-radio-${serial++}`;
    const rows: xnew.Unit[] = [];

    function apply(value: string) {
        for (const row of rows) {
            row.check(row.value === value);
        }
    }

    // an unselected group is a legitimate state, so nothing is adopted by default — only an explicit `value` picks
    if (value !== undefined) {
        xnew.timeout(() => apply(value));
    }

    // `items` is known right here, so the pick lands synchronously and `.value` reads true from tick 0
    xnew.standalone(() => {
        for (const item of items) {
            const def = itemDef(item);
            xnew(InputRadio, { ...def, checked: def.value === value });
        }
    });

    return {
        get name() {
            return shared;
        },
        // read by the segments: pointer-events alone would still leave a disabled group reachable by Tab
        get disabled() {
            return disabled;
        },
        get value() {
            return rows.find((row) => row.checked)?.value ?? '';
        },
        // the one write path: a segment press is routed here too, so both announce on the group's own element
        set value(value: string) {
            apply(value);
            dispatchCommit(container, value);
        },
        // the registry drops its entry when the segment is destroyed, so a rebuilt strip leaves no stale unit behind
        register(row: xnew.Unit) {
            rows.push(row);
            row.on('destroy', () => rows.splice(rows.indexOf(row), 1));
        },
    };
}

//----------------------------------------------------------------------------------------------------
// InputRadio — one segment; the checked tint is a pure CSS :has(input:checked) rule, so the look needs no JS
//----------------------------------------------------------------------------------------------------

export function InputRadio(unit: xnew.Unit,
    { value = '', label, name, checked = false, disabled = false, className = '', style = '', ...others }:
    { value?: string, label?: string, name?: string, checked?: boolean, disabled?: boolean, className?: string, style?: string, [key: string]: any } = {}
) {
    const group = xnew.context(InputRadioGroup);

    const css = xnew.css('base', {
        container: `
            padding: 0.25em 0.5em;
            flex: 1 1 0;
            display: flex; align-items: center; justify-content: center;
            white-space: nowrap;
            cursor: pointer; user-select: none;
            & + & { border-left: 1px solid currentColor; }
            &:hover { background: color-mix(in srgb, currentColor 10%, transparent); }
            &:has(input:checked) { background: color-mix(in srgb, currentColor 20%, transparent); }
            &:has(input:checked):hover { background: color-mix(in srgb, currentColor 30%, transparent); }
            &:focus-visible, &:has(:focus-visible) { outline: 2px solid currentColor; outline-offset: 1px; }
            &[data-disabled] { opacity: 0.5; cursor: default; pointer-events: none; }
        `,
        input: `
            width: 0; height: 0; margin: 0; opacity: 0;
        `,
    });

    xnew.nest({ tag: 'label', className: `${css.container} ${className}`, style, 'data-disabled': disabled === true ? '' : undefined });

    // a disabled group disables every segment: the group's own tint already covers the look, so only the input follows
    const inert = disabled === true || group?.disabled === true;
    const input = xnew({ tag: 'input', type: 'radio', name: name ?? group?.name, value, checked, disabled: inert, className: css.input, ...others });

    group?.register(unit);

    if (group !== undefined) {
        // the pick belongs to the group, which announces it as its own — exactly as a Listbox row hands the press to the Listbox
        unit.on('input change', ({ event }: { event: Event }) => event.stopPropagation());
        input.on('change', () => group.value = value);
    }

    // fall back to the label (or the value) as text when nothing is composed into the segment (same as ListboxItem)
    xnew.standalone(() => {
        xnew({ tag: 'span' }, label ?? value);
    });

    return {
        get value() {
            return (input.current as HTMLInputElement).value;
        },
        get label() {
            return label;
        },
        get checked() {
            return (input.current as HTMLInputElement).checked;
        },
        // announced like a native pick: the value event carries the chosen value, and unchecking is silent (native fires nothing either)
        set checked(current: boolean) {
            const element = input.current as HTMLInputElement;
            element.checked = current;
            if (current === true) {
                dispatchCommit(element, element.value);
            }
        },
        // sets the state without announcing — the announcing path is `.checked` (or the group's `.value`), same as ListboxItem.check
        check(current: boolean) {
            (input.current as HTMLInputElement).checked = current;
        },
        get input() {
            return input.current as HTMLInputElement;
        },
    };
}
