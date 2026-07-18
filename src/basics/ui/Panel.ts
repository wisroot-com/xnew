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
import { Listbox, ListboxMenu, ListboxItem } from '../element/Listbox';
import { Accordion } from './Accordion';

// nested is internal: group() marks its inner Panel so only the root creates the scroll container
interface PanelOptions { name?: string; open?: boolean; params?: Record<string, any>; nested?: boolean; }

export function Panel(unit: xnew.Unit, { params, nested = false }: PanelOptions) {
    const object = params ?? {} as Record<string, any>;

    if (nested === false) {
        // own scroll container inheriting the mount element's max-height, so the panel scrolls once the host constrains it;
        // the vertical padding sits outside the scrollport so the scrollbar stays clear of the host's rounded corners
        const css = xnew.css({
            // transparent track lets the surface behind show through, so the scrollbar blends into any background
            scroll: { body: 'overflow-y: auto; scrollbar-width: thin; scrollbar-color: color-mix(in srgb, currentColor 40%, transparent) transparent;' },
        });
        xnew.nest('<div style="display: flex; flex-direction: column; box-sizing: border-box; max-height: inherit; padding: 0.5em 0;">');
        xnew.nest(`<div class="${css.scroll}" style="min-height: 0; padding: 0 0.25em;">`);
    }

    return {
        group({ name, open, params }: PanelOptions, inner: Function) {
            return xnew((unit: xnew.Unit) => {
                xnew.extend(Group, { name, open });
                xnew.extend(Panel, { params: params ?? object, nested: true });
                inner(unit);
            });
        },
        button({ name = '' }: { name?: string } = {}) {
            return xnew(Button, { text: name, style: 'width: 100%;' });
        },
        listbox({ name = '', value, items = [] }: { name?: string, value?: string, items?: string[] } = {}) {
            object[name] = value ?? object[name] ?? items[0] ?? '';
            const box = xnew(List, { name, value: object[name], items });
            box.on('-change', ({ value }: { value: string }) => object[name] = value);
            return box;
        },
        range({ name = '', value, min = 0, max = 100, step = 1 }: { name?: string, value?: number, min?: number, max?: number, step?: number } = {}) {
            object[name] = value ?? object[name] ?? min;
            const range = xnew(Range, { name, value: object[name], min, max, step });
            range.on('input', ({ value }: { value: number }) => object[name] = value);
            return range;
        },
        checkbox({ name = '', value }: { name?: string, value?: boolean } = {}) {
            object[name] = value ?? object[name] ?? false;
            const checkbox = xnew(Checkbox, { name, value: object[name] });
            checkbox.on('input', ({ value }: { value: boolean }) => object[name] = value);
            return checkbox;
        },
        separator() {
            xnew(Separator);
        }
    }
}

function Group(group: xnew.Unit, { name, open = false }: { name?: string, open?: boolean }) {
    if (name) {
        xnew(`<div style="height: 2em; display: flex; align-items: center; cursor: pointer; user-select: none;">`, (header: xnew.Unit) => {
            header.on('click', () => group.gate.toggle());
            const chevron = xnew((unit: xnew.Unit) => xnew.extend(xicons.ChevronDown, { style: 'width: 1em; height: 1em; margin-right: 0.25em;' }));
            group.on('-transition', ({ value }: { value: number }) => {
                chevron.element.style.transform = `rotate(${(value - 1) * 90}deg)`;
            });
            xnew('<div>', name);
        });
    }
    xnew.extend(Accordion, { gate: { open } });

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

function List(unit: xnew.Unit, { name = '', value, items = [], ...others }: { name?: string, value?: string, items?: string[], [key: string]: any }) {
    xnew.nest(`<div style="display: flex; align-items: center; padding: 0.25em;">`);
    xnew('<div style="flex: 1; margin-left: 0.25em;">', name);

    // Listbox extends onto this unit (so its '-change' fires here); the floating list nests into its field
    xnew.extend(Listbox, { value, ...others, style: 'max-width: 60%; height: 2em;' });
    xnew(xicons.ChevronDown, { style: 'flex: none; width: 0.9em; height: 0.9em; margin-right: 0.5em;' });
    xnew(ListboxMenu, () => {
        items.forEach((item: string) => xnew(ListboxItem, { value: item }));
    });
}
