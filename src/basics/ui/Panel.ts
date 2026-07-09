//----------------------------------------------------------------------------------------------------
// Panel — stackable form-style settings panel
//
// Returns a builder API for laying out parameter rows backed by native form controls (range /
// checkbox / select / button). Values are written through to a shared `params` object so the
// panel can drive an external state bag without extra wiring. Groups can be nested and toggled
// open/closed via the Accordion transition; Select expands its option list in place the same way,
// so the list always sits on the panel's own surface (no popup background to match). The row
// controls (Group / Button / Range / Checkbox / Select / Separator) are private components of this file.
//
// - Panel : component({ params }) returning { group, button, select, range, checkbox, separator }
//
// Caveat: Panel nests its own scroll container (thin translucent scrollbar that lets the surface
// behind show through) inheriting the mount element's max-height — set a max-height on the mount
// element (without vertical padding) and the panel scrolls inside it.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { SVG } from '../element/SVG';
import { InputRange } from '../element/InputRange';
import { InputCheckbox } from '../element/InputCheckbox';
import { sharedCss } from '../styles';
import { OpenAndClose } from './OpenAndClose';
import { Accordion } from './Accordion';

// nested is internal: group() marks its inner Panel so only the root creates the scroll container
interface PanelOptions { name?: string; open?: boolean; params?: Record<string, any>; nested?: boolean; }

export function Panel(unit: xnew.Unit, { params, nested }: PanelOptions) {
    const object = params ?? {} as Record<string, any>;

    if (!nested) {
        // own scroll container inheriting the mount element's max-height, so the panel scrolls once the host constrains it;
        // the vertical padding sits outside the scrollport so the scrollbar stays clear of the host's rounded corners
        const cls = xnew.css(sharedCss);
        xnew.nest('<div style="display: flex; flex-direction: column; box-sizing: border-box; max-height: inherit; padding: 0.5em 0;">');
        xnew.nest(`<div class="${cls.scroll}" style="min-height: 0; padding: 0 0.25em;">`);
    }

    return {
        group({ name, open, params }: PanelOptions, inner: Function) {
            return xnew((unit: xnew.Unit) => {
                xnew.extend(Group, { name, open });
                xnew.extend(Panel, { params: params ?? object, nested: true });
                inner(unit);
            });
        },
        button(key: string) {
            return xnew(Button, { key });
        },
        select(key: string, { value, items = [] }: { value?: string, items?: string[] } = {}) {
            object[key] = value ?? object[key] ?? items[0] ?? '';
            const select = xnew(Select, { key, value: object[key], items });
            select.on('input', ({ value }: { value: string }) => object[key] = value);
            return select;
        },
        range(key: string, { value, min = 0, max = 100, step = 1 }: { value?: number, min?: number, max?: number, step?: number } = {}) {
            object[key] = value ?? object[key] ?? min;
            const range = xnew(Range, { key, value: object[key], min, max, step });
            range.on('input', ({ value }: { value: number }) => object[key] = value);
            return range;
        },
        checkbox(key: string, { value }: { value?: boolean } = {}) {
            object[key] = value ?? object[key] ?? false;
            const checkbox = xnew(Checkbox, { key, value: object[key] });
            checkbox.on('input', ({ value }: { value: boolean }) => object[key] = value);
            return checkbox;
        },
        separator() {
            xnew(Separator);
        }
    }
}

function Group(group: xnew.Unit, { name, open = false }: { name?: string, open?: boolean }) {
    const openAndClose = xnew.extend(OpenAndClose, { open });
    if (name) {
        const cls = xnew.css(sharedCss);
        xnew(`<div class="${cls.row} ${cls.clickable}">`, (unit: xnew.Unit) => {
            unit.on('click', () => openAndClose.toggle());
            xnew((unit: xnew.Unit) => {
                xnew.extend(SVG, { viewBox: '0 0 12 12', stroke: 'currentColor', style: 'width: 1em; height: 1em; margin-right: 0.25em;' });
                xnew('<path d="M6 2 10 6 6 10"/>');
                group.on('-transition', ({ value }: { value: number }) => unit.element.style.transform = `rotate(${value * 90}deg)`);
            });
            xnew('<div>', name);
        });
    }
    xnew.extend(Accordion);
}

function Button(unit: xnew.Unit, { key = '' }: { key?: string }) {
    const cls = xnew.css(sharedCss);
    xnew.nest(`<button class="${cls.row} ${cls.clickable} ${cls.frame} ${cls.hover} ${cls.press}" style="justify-content: center;">`, key);
}

function Separator(unit: xnew.Unit) {
    xnew.nest(`<div style="margin: 0.5em 0; border-top: 1px solid currentColor;">`);
}

function Range(unit: xnew.Unit,
    { key = '', value, min = 0, max = 100, step = 1 }:
    { key?: string, value?: number, min?: number, max?: number, step?: number }
) {
    value = value ?? min;
    const cls = xnew.css(sharedCss);

    xnew.nest(`<div class="${cls.row} ${cls.clickable}">`);

    xnew(InputRange, { name: key, value, min, max, step });

    // overlay labels (after the gauge so the text paints above the fill bar)
    const overlay = xnew(`<div class="${cls.overlay}" style="padding: 0 0.5em; display: flex; justify-content: space-between; align-items: center; pointer-events: none;">`);
    xnew(overlay, '<div>', key);
    const status = xnew(overlay, '<div>', String(value));

    unit.on('input', ({ value }: { value: number }) => {
        status.element.textContent = String(value);
    });
}

function Checkbox(unit: xnew.Unit, { key = '', value }: { key?: string, value?: boolean } = {}) {
    const cls = xnew.css(sharedCss);
    // label row so a click anywhere in the row reaches the boxed native input
    xnew.nest(`<label class="${cls.row} ${cls.clickable}" style="padding: 0 0.5em;">`);

    xnew('<div style="flex: 1;">', key);

    xnew('<div style="width: 1.25em; height: 1.25em;">', InputCheckbox, { name: key, value });
}

function Select(unit: xnew.Unit, { key = '', value, items = [] }: { key?: string, value?: string, items?: string[] } = {}) {
    const initial = value ?? items[0] ?? '';
    const cls = xnew.css(sharedCss);

    xnew.nest('<div>');

    const row = xnew(`<div class="${cls.row} ${cls.clickable}" style="padding: 0 0.5em;">`);
    xnew(row, '<div style="flex: 1;">', key);
    const button = xnew(row, `<div class="${cls.frame}" style="height: 2em; padding: 0 0.5em; display: flex; align-items: center; min-width: 3em; white-space: nowrap;">`, initial);

    // options expand in place below the row, so the list never leaves the panel surface
    const list = xnew((list: xnew.Unit) => {
        xnew.extend(OpenAndClose, { open: false });
        xnew.extend(Accordion);
        xnew.nest(`<div class="${cls.scroll}" style="max-height: 12em;">`);
        for (const item of items) {
            const div = xnew(`<div class="${cls.clickable} ${cls.hover}" style="height: 2em; padding: 0 1em; display: flex; align-items: center;">`, item);
            div.on('click', () => {
                button.element.textContent = item;
                (unit.element as HTMLSelectElement).value = item;
                unit.element.dispatchEvent(new Event('input', { bubbles: false }));
                list.close();
            });
        }
    });

    row.on('click', () => list.toggle());

    xnew.nest(`<select name="${key}" style="display: none;">`);
    for (const item of items) {
        xnew(`<option value="${item}" ${item === initial ? 'selected' : ''}>`, item);
    }
}
