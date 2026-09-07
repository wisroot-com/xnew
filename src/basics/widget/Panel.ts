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

// tab is group-only (a group naming a tab joins the panel's tab strip); nested is internal: group() marks its inner Panel so only the root creates the scroll container
interface PanelOptions { name?: string; open?: boolean; params?: Record<string, any>; key?: any; tab?: string; nested?: boolean; }

export function Panel(unit: xnew.Unit, { name, open, params, nested = false }: PanelOptions) {
    const object = params ?? {} as Record<string, any>;

    if (nested === false) {
        // own scrollport inheriting the host's max-height; the vertical padding sits outside it so the scrollbar clears the host's rounded corners
        const css = xnew.css({
            // transparent track lets the surface behind show through, so the scrollbar blends into any background
            scroll: 'overflow-y: auto; scrollbar-width: thin; scrollbar-color: color-mix(in srgb, currentColor 40%, transparent) transparent;',
        });
        xnew.nest('<div style="display: flex; flex-direction: column; box-sizing: border-box; max-height: inherit; padding: 0.5em 0;">');
        xnew.nest(`<div class="${css.scroll}" style="min-height: 0; padding: 0 0.25em;">`);
    }

    // every panel wraps its own rows, so `container` is the handle a tab uses to show / hide it as a whole
    xnew.nest('<div>');

    // an `open` value (true / false) makes the panel collapsible; leaving it undefined keeps the rows always shown
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

    // '-change' fires on the panel itself when a tab is picked
    const notify = xnew.scope((name: string) => xnew.emit('-change', { value: name }));

    // created up front so the strip stays at the top of the panel however late its groups declare a tab
    const tabs = xnew(Tabs, { notify });

    return {
        // the same word as group({ tab }): reading gives the active caption, writing switches as a press does (an unknown name is ignored)
        get tab() {
            return tabs.active;
        },
        set tab(name: string) {
            tabs.select(name);
        },
        // every row takes `key` so xnew.find can reach it later; it rides along to the inner control, so find by that control's component
        group({ name, open, params, key, tab }: PanelOptions, inner: Function) {
            const group = xnew((unit: xnew.Unit) => {
                xnew.extend(Panel, { name, open, params: params ?? object, nested: true });
                inner(unit);
            }, { key });
            if (tab !== undefined) {
                tabs.add(tab, group);
            }
            return group;
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

// underline strip pinned to the top of a panel; it stays empty and invisible until a group declares a tab
function Tabs(unit: xnew.Unit, { notify }: { notify: (name: string) => void }) {
    const strip = xnew.nest('<div style="display: none; border-bottom: 1px solid color-mix(in srgb, currentColor 25%, transparent); margin-bottom: 0.25em;">');

    const tabs: { name: string, button: xnew.Unit, groups: xnew.Unit[] }[] = [];
    let active = '';

    // the active tab shows its own groups as a whole and hides every other tab's
    function apply() {
        tabs.forEach(({ name, groups }) => {
            groups.forEach((group: xnew.Unit) => {
                if (group.container !== null) {
                    group.container.style.display = name === active ? '' : 'none';
                }
            });
        });
    }

    function paint() {
        tabs.forEach(({ name, button }) => {
            const on = name === active;
            button.current.style.borderBottomColor = on ? 'currentColor' : 'transparent';
            button.current.style.fontWeight = on ? '600' : '400';
            button.current.style.opacity = on ? '1' : '0.55';
        });
    }

    // one path for both the button and a code-driven switch, so either notifies the same way
    function select(name: string) {
        if (tabs.some((tab) => tab.name === name) === false) {
            return;
        }
        active = name;
        paint();
        apply();
        notify(name);
    }

    return {
        select,
        get active() {
            return active;
        },
        // groups declaring the same name share one button, and the first name declared starts active
        add(name: string, group: xnew.Unit) {
            let tab = tabs.find((tab) => tab.name === name);
            if (tab === undefined) {
                const button = xnew('<button type="button" style="flex: 1; min-width: 0; height: 2em; padding: 0 0.25em; border: none; border-bottom: 2px solid transparent; margin-bottom: -1px; background: transparent; color: inherit; font: inherit; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">', name);
                button.on('click', () => select(name));
                tab = { name, button, groups: [] };
                tabs.push(tab);
                strip.style.display = 'flex';
                if (active === '') {
                    active = name;
                }
            }
            tab.groups.push(group);
            paint();
            apply();
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
