//----------------------------------------------------------------------------------------------------
// Panel — stackable form-style settings panel with a builder API; a row reports its edits through
// its own events ('input' / 'change'), so the host decides what to do with them.
// Every value-bearing row (range / checkbox / color / listbox / tabs) reads and writes through `.value`,
// delegating to the control it owns, and reporting like a native input: `input` while a value moves,
// `change` once it settles, and both together for a click, a typed entry or a `.value` set.
// The frame (size / border / scrollport) is the panel's own; className / style tune it from outside.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { dispatchChange, dispatchCommit, dispatchInput } from '../../utils/dom';
import { xicons } from '../../icons/xicons';
import { Button } from '../element/Button';
import { InputRange } from '../element/InputRange';
import { InputCheckbox } from '../element/InputCheckbox';
import { Listbox, ListboxButton, ListboxMenu, ListboxItem, ItemDef, itemDef } from '../element/Listbox';
import { Accordion } from './Accordion';
import { Gate } from './Gate';
import { ToggleBar } from './ToggleBar';
import { Overlay } from './Overlay';
import { ColorPicker } from '../element/ColorPicker';

// `key` is only read by group(); the rest are shared by Panel and PanelGroup
interface PanelOptions { name?: string; open?: boolean; key?: any; }

export function Panel(unit: xnew.Unit,
    { name, open, className = '', style = '' }:
    PanelOptions & { className?: string, style?: string } = {}
) {
    const css = xnew.css('base', {
        // the frame doubles as the scrollport: rows scroll inside it, and max-height: inherit still lets a capped host shorten it
        container: `
            box-sizing: border-box;
            width: 12em; max-width: -webkit-fill-available; max-width: -moz-available; max-width: stretch;
            max-height: inherit;
            padding: 0 0.25em;
            border: 1px solid color-mix(in srgb, currentColor 25%, transparent); border-radius: 0.25em;
            overflow-y: auto; scrollbar-width: thin;
            scrollbar-color: color-mix(in srgb, currentColor 40%, transparent) transparent;
        `,
    });
    xnew.nest({ tag: 'div', className: `${css.container} ${className}`, style });

    // the whole builder API lives in PanelGroup; Panel is only the frame wrapped around the outermost one
    xnew.extend(PanelGroup, { name, open });
}

//----------------------------------------------------------------------------------------------------
// PanelGroup — one block of rows plus the builder API; both Panel and group() extend it
// Exported so a group made by group({ key }) stays reachable with xnew.find(PanelGroup, { key }).
//----------------------------------------------------------------------------------------------------

export function PanelGroup(unit: xnew.Unit, { name, open }: PanelOptions) {
    // every group wraps its own rows, so `container` is the handle a tab uses to show / hide it as a whole
    xnew.nest('<div>');

    // an `open` value (true / false) makes the group collapsible; leaving it undefined keeps the rows always shown
    if (open !== undefined) {
        const gate = xnew(Gate, { open, duration: 200 });

        if (name) {
            xnew(ToggleBar, { gate, label: name });
        }
        xnew.extend(Accordion, { gate });
    }

    return {
        // a tab strip over the groups of this panel: an item's value is the group key it switches, and `value` picks the tab that starts active
        tabs({ items = [], value }: { items?: ItemDef<any>[], value?: any } = {}) {
            return xnew(Tabs, { items, value });
        },
        // every row takes `key` so xnew.find can reach it later; it rides along to the inner control, so find by that control's component
        group({ name, open, key }: PanelOptions, inner?: (group: xnew.Unit) => void) {
            return xnew((unit: xnew.Unit) => {
                xnew.extend(PanelGroup, { name, open });
                inner?.(unit);
            }, { key });
        },
        button({ name = '', key }: { name?: string, key?: any } = {}) {
            return xnew(Button, { text: name, key, style: 'width: 100%;' });
        },
        listbox({ name = '', value, items = [], key }: { name?: string, value?: string, items?: ItemDef[], key?: any } = {}) {
            return xnew(List, { name, value: value ?? (items.length > 0 ? itemDef(items[0]).value : ''), items, key });
        },
        range({ name = '', value, min = 0, max = 100, step, key }: { name?: string, value?: number, min?: number, max?: number, step?: number, key?: any } = {}) {
            return xnew(Range, { name, value: value ?? min, min, max, step, key });
        },
        checkbox({ name = '', value = false, key }: { name?: string, value?: boolean, key?: any } = {}) {
            return xnew(Checkbox, { name, value, key });
        },
        color({ name = '', value = '#ffffff', key }: { name?: string, value?: string, key?: any } = {}) {
            return xnew(Color, { name, value, key });
        },
        separator() {
            xnew(Separator);
        }
    };
}

// underline strip switching the sibling groups of one panel; a group no tab item names stays visible whichever tab is on
function Tabs(unit: xnew.Unit, { items, value }: { items: ItemDef<any>[], value?: any }) {
    const css = xnew.css('base', {
        strip: `
            display: flex;
            border-bottom: 1px solid color-mix(in srgb, currentColor 25%, transparent);
            margin-bottom: 0.25em;
        `,
        tab: `
            flex: 1; min-width: 0; height: 2em; padding: 0 0.25em;
            border: none; border-bottom: 2px solid transparent; margin-bottom: -1px;
            background: transparent; color: inherit; font: inherit; cursor: pointer;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            opacity: 0.55;
            &[data-active] { border-bottom-color: currentColor; font-weight: 600; opacity: 1; }
        `,
    });
    const strip = xnew.nest({ tag: 'div', className: css.strip }) as HTMLElement;

    // the groups a tab names are this strip's siblings, so the panel above holds both
    const panel = unit.parent as xnew.Unit;
    const defs = items.map((item) => itemDef(item));
    const keys = defs.map((def) => def.value);
    let active = value ?? keys[0] ?? '';

    const tabs = defs.map((def) => {
        const tab = xnew({ tag: 'button', type: 'button', className: css.tab }, def.label ?? String(def.value));
        tab.on('click', () => select(def.value));
        return tab;
    });

    // both halves of a switch in one pass: the strip's marks and the groups' visibility
    function apply() {
        keys.forEach((key, index) => {
            tabs[index].current.toggleAttribute('data-active', key === active);
            xnew.find(PanelGroup, { parent: panel, key }).forEach(({ container }: xnew.Unit) => {
                if (container !== null) {
                    container.style.display = key === active ? '' : 'none';
                }
            });
        });
    }

    // one path for both the button and a host assignment through `.value`, so either notifies the same way
    function select(key: any) {
        if (keys.includes(key) === true) {
            active = key;
            apply();
            dispatchCommit(strip, key);
        }
    }

    apply();

    // a group can be declared after the strip, so every child joining the panel is a reason to look again
    panel?.on('childattach', apply);

    return {
        get value() {
            return active;
        },
        // the one write path: a tab press and a host assignment are the same act, so both announce (as in Listbox)
        set value(key: any) {
            select(key);
        },
    };
}

function Separator(unit: xnew.Unit) {
    xnew.nest(`<div style="margin: 0.5em 0; border-top: 1px solid currentColor;">`);
}

function Range(unit: xnew.Unit, { name = '', ...others }: { name?: string, [key: string]: any }) {
    xnew.nest(`<div style="display: flex; align-items: center; position: relative; cursor: pointer; user-select: none;">`);

    // a child unit rather than an extend, so InputRange stays standalone and keeps drawing its meter / status
    const range = xnew(InputRange, { name, ...others, style: 'width: 100%;' });

    xnew('<div style="position: absolute; left: 0.5em; pointer-events: none;">', name);

    return {
        get value() {
            return range.value;
        },
        set value(number: number) {
            range.value = number;
        },
    };
}

function Checkbox(unit: xnew.Unit, { name = '', ...others }: { name?: string, [key: string]: any }) {
    xnew.nest(`<label style="display: flex; align-items: center; cursor: pointer; user-select: none; padding: 0.25em;">`);
    xnew('<div style="flex: 1; margin-left: 0.25em;">', name);

    // a child unit rather than an extend, so InputCheckbox stays standalone and keeps drawing its mark
    const checkbox = xnew(InputCheckbox, { name, ...others, style: 'width: 1.25em; height: 1.25em;' });

    return {
        get value() {
            return checkbox.value;
        },
        set value(checked: boolean) {
            checkbox.value = checked;
        },
    };
}

function Color(unit: xnew.Unit, { name = '', value = '#ffffff' }: { name?: string, value?: string, key?: any }) {
    const row = xnew.nest(`<div style="display: flex; align-items: center; padding: 0.25em;">`) as HTMLElement;
    xnew('<div style="flex: 1; margin-left: 0.25em;">', name);

    let current = value;
    const swatch = xnew({ tag: 'button', type: 'button', style: 'height: 2em; flex: 1; max-width: 60%; border: 1px solid currentColor; border-radius: 0.25em; cursor: pointer;' });
    swatch.current.style.background = current;


    let popup: xnew.Unit | null = null;
    swatch.on('click', ({ event }: { event: PointerEvent }) => {
        event.stopPropagation();
        if (popup === null) {
            popup = xnew(ColorPopup, {
                anchor: swatch.current as HTMLElement,
                value: current,
                // the element is captured, so this needs no xnew.scope even though it runs in the popup's scope
                commit(next: string, settled: boolean) {
                    current = next;
                    swatch.current.style.background = next;
                    if (settled === true) {
                        dispatchChange(row, next);
                    } else {
                        dispatchInput(row, next);
                    }
                },
            });
            popup.on('destroy', () => popup = null);
        } else {
            // a re-press lands outside the popup, so it is already closing; just make it explicit
            popup.gate.close();
        }
    });

    return {
        get value() {
            return current;
        },
        set value(text: string) {
            current = text;
            swatch.current.style.background = text;
            dispatchCommit(row, text);
        },
    };
}

function ColorPopup(unit: xnew.Unit, { anchor, value, commit }: { anchor: HTMLElement, value: string, commit: (value: string, settled: boolean) => void }) {
    // Overlay backdrop blocks the page and tracks the swatch rect; close destroys this unit
    const gate = xnew(Gate, { open: false, duration: 100 });
    xnew.extend(Overlay, { gate, anchor });
    gate.on('-closed', () => unit.destroy());

    // the picker hangs just below the tracked swatch box, right-aligned
    xnew.nest('<div style="position: absolute; top: 100%; right: 0; padding: 0.25em 0;">');
    // close on a press outside (not click, so a drag released outside the picker cannot close it)
    unit.on('pointerdown.outside', () => gate.close());

    // the picker hangs inside the row, so its own events would read as the row's; the row re-fires them
    // as its own, keeping the native split (dragging the bars streams input, releasing settles it)
    xnew(ColorPicker, { value }).on('input change', ({ event, value }: { event: Event, value: string }) => {
        event.stopPropagation();
        commit(value, event.type === 'change');
    });

    gate.open();
}

function List(unit: xnew.Unit, { name = '', value, items = [], ...others }: { name?: string, value?: string, items?: ItemDef[], [key: string]: any }) {
    xnew.nest(`<div style="display: flex; align-items: center; padding: 0.25em;">`);
    xnew('<div style="flex: 1; margin-left: 0.25em;">', name);

    // Listbox extends onto this unit (so its 'change' fires here); the button draws the trigger, the floating list nests in
    xnew.extend(Listbox, { value, ...others, style: 'max-width: 60%;' });
    xnew(() => {
        xnew.extend(ListboxButton, { style: 'height: 2em;' });
        xnew(xicons.ChevronDown, { style: 'flex: none; width: 0.9em; height: 0.9em;' });
    });
    xnew(() => {
        xnew.extend(ListboxMenu);
        items.forEach((item: ItemDef) => xnew(ListboxItem, itemDef(item)));
    });
}
