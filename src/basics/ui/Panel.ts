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
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { SVG } from '../element/SVG';
import { sharedCss } from '../styles';
import { OpenAndClose } from './OpenAndClose';
import { Accordion } from './Accordion';

interface PanelOptions { name?: string; open?: boolean; params?: Record<string, any>; }

export function Panel(unit: xnew.Unit, { params }: PanelOptions) {
    const object = params ?? {} as Record<string, any>;

    return {
        group({ name, open, params }: PanelOptions, inner: Function) {
            const group = xnew((unit: xnew.Unit) => {
                xnew.extend(Group, { name, open });
                xnew.extend(Panel, { params: params ?? object });
                inner(unit);
            });
            return group;
        },
        button(key: string) {
            const button = xnew(Button, { key });
            return button;
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

    // fill bar
    const ratio = (value - min) / (max - min);
    const fill = xnew(`<div class="${cls.frame} ${cls.pale}" style="position: absolute; top: 0; left: 0; bottom: 0; width: ${ratio * 100}%; transition: width 0.05s;">`);

    // overlay labels
    const status = xnew(`<div class="${cls.overlay}" style="padding: 0 0.5em; display: flex; justify-content: space-between; align-items: center; pointer-events: none;">`, (unit: xnew.Unit) => {
        xnew('<div>', key);
        xnew('<div key="status">', value);
    });

    // hidden native input for interaction
    xnew.nest(`<input type="range" name="${key}" min="${min}" max="${max}" step="${step}" value="${value}" class="${cls.hiddenInput}">`);

    unit.on('input', ({ event }: { event: Event }) => {
        const v = Number((event.target as HTMLInputElement).value);
        const r = (v - min) / (max - min);
        fill.element.style.width = `${r * 100}%`;
        status.element.querySelector('[key="status"]')!.textContent = String(v);
    });
}

function Checkbox(unit: xnew.Unit, { key = '', value }: { key?: string, value?: boolean } = {}) {
    const cls = xnew.css(sharedCss);
    xnew.nest(`<div class="${cls.row} ${cls.clickable}" style="padding: 0 0.5em;">`);

    xnew('<div style="flex: 1;">', key);

    const box = xnew(`<div class="${cls.frame}" style="width: 1.25em; height: 1.25em; display: flex; align-items: center; justify-content: center;">`, () => {
        xnew((unit: xnew.Unit) => {
            xnew.extend(SVG, { viewBox: '0 0 12 12', style: 'width: 1.25em; height: 1.25em; opacity: 0;', stroke: 'currentColor', strokeWidth: 2 });
            xnew('<path d="M2 6 5 9 10 3" />');
        });
    });
    const check = box.element.querySelector('svg') as SVGElement;

    const update = (checked: boolean) => {
        box.element.classList.toggle(cls.pale, checked);
        check.style.opacity = checked ? '1' : '0';
    };
    update(!!value);
    xnew.nest(`<input type="checkbox" name="${key}" ${value ? 'checked' : ''} class="${cls.hiddenInput}">`);
    unit.on('input', ({ value }: { value: boolean }) => {
        update(value);
    });
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
        xnew.nest('<div style="max-height: 12em; overflow-y: auto;">');
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
