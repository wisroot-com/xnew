//----------------------------------------------------------------------------------------------------
// Panel — stackable form-style settings panel
//
// Returns a builder API for laying out parameter rows backed by the Input* elements (range /
// checkbox / select) and buttons. Values are written through to a shared `params` object so the
// panel can drive an external state bag without extra wiring. Groups can be nested and toggled
// open/closed via the Accordion transition. The row controls (Group / Button / Range / Checkbox /
// Select / Separator) are private components of this file.
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
import { InputSelect } from '../element/InputSelect';
import { sharedCss } from '../styles';
import { OpenAndClose } from './OpenAndClose';
import { Accordion } from './Accordion';

// nested is internal: group() marks its inner Panel so only the root creates the scroll container
interface PanelOptions { name?: string; open?: boolean; params?: Record<string, any>; nested?: boolean; }

// one form row of the panel
const rowStyle = 'position: relative; height: 2em; margin: 0.125em 0; display: flex; align-items: center;';

const panelCss = {
    press: '&:active { filter: brightness(0.5); }',
};

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
        button({ name = '' }: { name?: string } = {}) {
            return xnew(Button, { name });
        },
        select({ name = '', value, items = [] }: { name?: string, value?: string, items?: string[] } = {}) {
            object[name] = value ?? object[name] ?? items[0] ?? '';
            const select = xnew(Select, { name, value: object[name], items });
            select.on('input', ({ value }: { value: string }) => object[name] = value);
            return select;
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
    const openAndClose = xnew.extend(OpenAndClose, { open });
    if (name) {
        const cls = xnew.css(sharedCss);
        xnew(`<div class="${cls.clickable}" style="${rowStyle}">`, (unit: xnew.Unit) => {
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

function Button(unit: xnew.Unit, { name = '' }: { name?: string }) {
    const cls = xnew.css(sharedCss);
    const btn = xnew.css(panelCss);
    xnew.nest(`<button class="${cls.clickable} ${cls.frame} ${cls.hoverTint} ${btn.press}" style="${rowStyle} justify-content: center;">`, name);
}

function Separator(unit: xnew.Unit) {
    xnew.nest(`<div style="margin: 0.5em 0; border-top: 1px solid currentColor;">`);
}

function Range(unit: xnew.Unit,
    { name = '', value, min = 0, max = 100, step = 1 }:
    { name?: string, value?: number, min?: number, max?: number, step?: number }
) {
    value = value ?? min;
    const cls = xnew.css(sharedCss);

    xnew.nest(`<div class="${cls.clickable}" style="${rowStyle}">`);

    xnew(InputRange, { name, value, min, max, step });

    // overlay labels (after the gauge so the text paints above the fill bar)
    const overlay = xnew('<div style="position: absolute; inset: 0; width: 100%; height: 100%; box-sizing: border-box; padding: 0 0.5em; display: flex; justify-content: space-between; align-items: center; pointer-events: none;">');
    xnew(overlay, '<div>', name);
    const status = xnew(overlay, '<div>', String(value));

    unit.on('input', ({ value }: { value: number }) => {
        status.element.textContent = String(value);
    });
}

function Checkbox(unit: xnew.Unit, { name = '', value }: { name?: string, value?: boolean } = {}) {
    const cls = xnew.css(sharedCss);
    // label row so a click anywhere in the row reaches the boxed native input
    xnew.nest(`<label class="${cls.clickable}" style="${rowStyle} padding: 0 0.5em;">`);

    xnew('<div style="flex: 1;">', name);

    xnew('<div style="width: 1.25em; height: 1.25em;">', InputCheckbox, { name, value });
}

function Select(unit: xnew.Unit, { name = '', value, items = [] }: { name?: string, value?: string, items?: string[] } = {}) {
    // label row; the pulldown itself is InputSelect, whose input event bubbles up to this row
    xnew.nest(`<div style="${rowStyle} padding: 0 0.5em;">`);

    xnew('<div style="flex: 1;">', name);

    xnew('<div style="height: 2em; min-width: 3em;">', InputSelect, { name, value, items });
}
