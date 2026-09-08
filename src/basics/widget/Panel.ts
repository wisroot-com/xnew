//----------------------------------------------------------------------------------------------------
// Panel — stackable form-style settings panel with a builder API; a row reports its edits through
// its own events ('input' / '-change'), so the host decides what to do with them.
// Every value-bearing row (range / checkbox / color / listbox / tabs) reads and writes through `.value`,
// delegating to the control it owns; a `.value` set never emits '-change' (only a user edit does).
// The frame (size / border / scrollport) is the panel's own; className / style tune it from outside.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { xicons } from '../../icons/xicons';
import { Button } from '../element/Button';
import { InputRange } from '../element/InputRange';
import { InputCheckbox } from '../element/InputCheckbox';
import { Listbox, ListboxButton, ListboxMenu, ListboxItem, ItemDef, itemDef } from '../element/Listbox';
import { Accordion } from './Accordion';
import { Gate } from './Gate';
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
            xnew(`<div style="height: 2em; display: flex; align-items: center; cursor: pointer; user-select: none;">`, (header: xnew.Unit) => {
                header.on('click', () => gate.toggle());
                const chevron = xnew((unit: xnew.Unit) => xnew.extend(xicons.ChevronDown, { style: 'width: 1em; height: 1em; margin-right: 0.25em;' }));
                gate.on('-transition', ({ value }: { value: number }) => {
                    chevron.current.style.transform = `rotate(${(value - 1) * 90}deg)`;
                });
                xnew('<div>', name);
            });
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
    xnew.nest({ tag: 'div', className: css.strip });

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

    // moves the strip without announcing it; `select` adds the notification on top
    function move(key: any): boolean {
        if (keys.includes(key) === false) {
            return false;
        }
        active = key;
        apply();
        return true;
    }

    // one path for both the button and a code-driven switch, so either notifies the same way
    function select(key: any) {
        if (move(key) === true) {
            xnew.emit('-change', { value: key });
        }
    }

    apply();

    // a group can be declared after the strip, so every child joining the panel is a reason to look again
    panel?.on('childattach', apply);

    return {
        select,
        get value() {
            return active;
        },
        // a programmatic set is not a user press, so it switches without emitting -change (as in Listbox)
        set value(key: any) {
            move(key);
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
    xnew.nest(`<div style="display: flex; align-items: center; padding: 0.25em;">`);
    xnew('<div style="flex: 1; margin-left: 0.25em;">', name);

    let current = value;
    const swatch = xnew({ tag: 'button', type: 'button', style: 'height: 2em; flex: 1; max-width: 60%; border: 1px solid currentColor; border-radius: 0.25em; cursor: pointer;' });
    swatch.current.style.background = current;

    // '-change' must fire on this row unit, while commits arrive from the popup's scope
    const notify = xnew.scope(() => xnew.emit('-change', { value: current }));

    let popup: xnew.Unit | null = null;
    swatch.on('click', ({ event }: { event: PointerEvent }) => {
        event.stopPropagation();
        if (popup === null) {
            popup = xnew(ColorPopup, {
                anchor: swatch.current as HTMLElement,
                value: current,
                commit(next: string) {
                    current = next;
                    swatch.current.style.background = next;
                    notify();
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
        // only the swatch moves; `-change` stays reserved for edits made in the picker
        set value(text: string) {
            current = text;
            swatch.current.style.background = text;
        },
    };
}

function ColorPopup(unit: xnew.Unit, { anchor, value, commit }: { anchor: HTMLElement, value: string, commit: (value: string) => void }) {
    // Overlay backdrop blocks the page and tracks the swatch rect; close destroys this unit
    xnew.extend(Overlay, { gate: { open: false, duration: 100 }, anchor });
    unit.gate.on('-closed', () => unit.destroy());

    // the picker hangs just below the tracked swatch box, right-aligned
    xnew.nest('<div style="position: absolute; top: 100%; right: 0; padding: 0.25em 0;">');
    // close on a press outside (not click, so a drag released outside the picker cannot close it)
    unit.on('pointerdown.outside', () => unit.gate.close());

    xnew(ColorPicker, { value }).on('-change', ({ value }: { value: string }) => commit(value));

    unit.gate.open();
}

function List(unit: xnew.Unit, { name = '', value, items = [], ...others }: { name?: string, value?: string, items?: ItemDef[], [key: string]: any }) {
    xnew.nest(`<div style="display: flex; align-items: center; padding: 0.25em;">`);
    xnew('<div style="flex: 1; margin-left: 0.25em;">', name);

    // Listbox extends onto this unit (so its '-change' fires here); the button draws the trigger, the floating list nests in
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
