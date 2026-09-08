//----------------------------------------------------------------------------------------------------
// Panel — stackable form-style settings panel with a builder API; row values write through to a
// shared `params` object so the panel drives an external state bag without extra wiring.
// Caveat: give the mount element a max-height (no vertical padding); the panel scrolls inside it.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { xicons } from '../../icons/xicons';
import { Button } from '../element/Button';
import { InputRange } from '../element/InputRange';
import { InputCheckbox } from '../element/InputCheckbox';
import { Listbox, ListboxButton, ListboxMenu, ListboxItem } from '../element/Listbox';
import { Accordion } from './Accordion';
import { Gate } from './Gate';
import { Overlay } from './Overlay';
import { ColorPicker } from './ColorPicker';

// `key` is only read by group(); the rest are shared by Panel and Group
interface PanelOptions { name?: string; open?: boolean; params?: Record<string, any>; key?: any; }

export function Panel(unit: xnew.Unit, { name, open, params }: PanelOptions) {
    const css = xnew.css({
        // transparent track lets the surface behind show through, so the scrollbar blends into any background
        scroll: 'overflow-y: auto; scrollbar-width: thin; scrollbar-color: color-mix(in srgb, currentColor 40%, transparent) transparent;',
    });
    // the scrollport borrows the host's cap through max-height: inherit, so the rows scroll inside the mount element
    xnew.nest(`<div class="${css.scroll}" style="box-sizing: border-box; max-height: inherit;">`);

    // the whole builder API lives in Group; Panel is only the scrollport wrapped around the outermost one
    return xnew.extend(Group, { name, open, params });
}

//----------------------------------------------------------------------------------------------------
// Group — one block of rows plus the builder API; internal, so both Panel and group() extend it
//----------------------------------------------------------------------------------------------------

function Group(unit: xnew.Unit, { name, open, params }: PanelOptions) {
    const object = params ?? {} as Record<string, any>;

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
        // a tab strip over the groups of this panel: names maps a group key to its button caption, and the first key starts active
        tabs({ names = {} }: { names?: Record<string, string> } = {}) {
            return xnew(Tabs, { names });
        },
        // every row takes `key` so xnew.find can reach it later; it rides along to the inner control, so find by that control's component
        group({ name, open, params, key }: PanelOptions, inner: Function) {
            return xnew((unit: xnew.Unit) => {
                xnew.extend(Group, { name, open, params: params ?? object });
                inner(unit);
            }, { key });
        },
        button({ name = '', key }: { name?: string, key?: any } = {}) {
            return xnew(Button, { text: name, key, style: 'width: 100%;' });
        },
        listbox({ name = '', value, items = [], key }: { name?: string, value?: string, items?: string[], key?: any } = {}) {
            object[name] = value ?? object[name] ?? items[0] ?? '';
            const box = xnew(List, { name, value: object[name], items, key });
            box.on('-change', ({ value }: { value: string }) => object[name] = value);
            return box;
        },
        range({ name = '', value, min = 0, max = 100, step, key }: { name?: string, value?: number, min?: number, max?: number, step?: number, key?: any } = {}) {
            object[name] = value ?? object[name] ?? min;
            const range = xnew(Range, { name, value: object[name], min, max, step, key });
            range.on('input', ({ value }: { value: number }) => object[name] = value);
            return range;
        },
        checkbox({ name = '', value, key }: { name?: string, value?: boolean, key?: any } = {}) {
            object[name] = value ?? object[name] ?? false;
            const checkbox = xnew(Checkbox, { name, value: object[name], key });
            checkbox.on('input', ({ value }: { value: boolean }) => object[name] = value);
            return checkbox;
        },
        color({ name = '', value, key }: { name?: string, value?: string, key?: any } = {}) {
            object[name] = value ?? object[name] ?? '#ffffff';
            const color = xnew(Color, { name, value: object[name], key });
            color.on('-change', ({ value }: { value: string }) => object[name] = value);
            return color;
        },
        separator() {
            xnew(Separator);
        }
    }
}

// underline strip switching the sibling groups of one panel; a group whose key no tab names stays visible whichever tab is on
function Tabs(unit: xnew.Unit, { names }: { names: Record<string, string> }) {
    xnew.nest('<div style="display: flex; border-bottom: 1px solid color-mix(in srgb, currentColor 25%, transparent); margin-bottom: 0.25em;">');

    // the groups a tab names are this strip's siblings, so the panel above holds both
    const panel = unit.parent as xnew.Unit;
    const keys = Object.keys(names);
    const buttons = keys.map((key) => {
        const button = xnew('<button type="button" style="flex: 1; min-width: 0; height: 2em; padding: 0 0.25em; border: none; border-bottom: 2px solid transparent; margin-bottom: -1px; background: transparent; color: inherit; font: inherit; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">', names[key]);

        button.on('click', () => select(key));
        return { key, button };
    });

    let active = keys[0] ?? '';

    function apply() {
        keys.forEach((key) => {
            xnew.find(Group, { parent: panel, key }).forEach((group: xnew.Unit) => {
                if (group.container !== null) {
                    group.container.style.display = key === active ? '' : 'none';
                }
            });
        });
    }

    function paint() {
        buttons.forEach(({ key, button }) => {
            const on = key === active;
            button.current.style.borderBottomColor = on ? 'currentColor' : 'transparent';
            button.current.style.fontWeight = on ? '600' : '400';
            button.current.style.opacity = on ? '1' : '0.55';
        });
    }

    // one path for both the button and a code-driven switch, so either notifies the same way
    function select(key: string) {
        if (keys.includes(key) === false) {
            return;
        }
        active = key;
        paint();
        apply();
        xnew.emit('-change', { value: key });
    }

    paint();
    apply();

    // a group can be declared after the strip, so every child joining the panel is a reason to look again
    panel?.on('childattach', apply);

    return {
        select,
        get active() {
            return active;
        },
    };
}

function Separator(unit: xnew.Unit) {
    xnew.nest(`<div style="margin: 0.5em 0; border-top: 1px solid currentColor;">`);
}

function Range(unit: xnew.Unit, { name = '', ...others }: { name?: string, [key: string]: any }) {
    xnew.nest(`<div style="display: flex; align-items: center; position: relative; cursor: pointer; user-select: none;">`);

    xnew(InputRange, { name, ...others, style: 'width: 100%;' });

    xnew('<div style="position: absolute; left: 0.5em; pointer-events: none;">', name);
}

function Checkbox(unit: xnew.Unit, { name = '', ...others }: { name?: string, [key: string]: any }) {
    xnew.nest(`<label style="display: flex; align-items: center; cursor: pointer; user-select: none; padding: 0.25em;">`);
    xnew('<div style="flex: 1; margin-left: 0.25em;">', name);

    xnew(InputCheckbox, { name, ...others, style: 'width: 1.25em; height: 1.25em;' });
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
            popup.on('finalize', () => popup = null);
        } else {
            // a re-press lands outside the popup, so it is already closing; just make it explicit
            popup.gate.close();
        }
    });

    return {
        get value() {
            return current;
        },
    };
}

function ColorPopup(unit: xnew.Unit, { anchor, value, commit }: { anchor: HTMLElement, value: string, commit: (value: string) => void }) {
    // Overlay backdrop blocks the page and tracks the swatch rect; close finalizes this unit
    xnew.extend(Overlay, { gate: { open: false, duration: 100 }, anchor });
    unit.gate.on('-closed', () => unit.finalize());

    // the picker hangs just below the tracked swatch box, right-aligned
    xnew.nest('<div style="position: absolute; top: 100%; right: 0; padding: 0.25em 0;">');
    // close on a press outside (not click, so a drag released outside the picker cannot close it)
    unit.on('pointerdown.outside', () => unit.gate.close());

    xnew(ColorPicker, { value }).on('-change', ({ value }: { value: string }) => commit(value));

    unit.gate.open();
}

function List(unit: xnew.Unit, { name = '', value, items = [], ...others }: { name?: string, value?: string, items?: string[], [key: string]: any }) {
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
        items.forEach((item: string) => xnew(ListboxItem, { value: item }));
    });
}
