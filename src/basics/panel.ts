//----------------------------------------------------------------------------------------------------
// Panel — stackable form-style settings panel
//
// Returns a builder API for laying out parameter rows backed by native form controls (range /
// checkbox / select / button). Values are written through to a shared `params` object so the
// panel can drive an external state bag without extra wiring. Groups can be nested and toggled
// open/closed via the Accordion transition.
//
// - Panel : component({ params }) returning { group, button, select, range, checkbox, separator }
//----------------------------------------------------------------------------------------------------

import { xnew } from '../core/xnew';
import { Unit, ComponentFn } from '../core/unit';
import { SVG } from './svg';
import { OpenAndClose, Accordion, Popup } from './transition';

interface PanelOptions { name?: string; open?: boolean; params?: Record<string, any>; }

const paleColor = 'color-mix(in srgb, currentColor 20%, transparent)';

// hidden native control overlaid on the styled row to capture interaction
const hiddenInput = 'position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; margin: 0;';

export function Panel(unit: Unit, { params }: PanelOptions) {
    const object = params ?? {} as Record<string, any>;

    // resolve the initial value, mount the control and write changes back to `object`
    function field(key: string, value: any, fallback: any, Component: ComponentFn<any, any>, props: object) {
        object[key] = value ?? object[key] ?? fallback;
        const control = xnew(Component, { key, value: object[key], ...props });
        control.on('input', ({ value }: { value: any }) => object[key] = value);
        return control;
    }

    return {
        group({ name, open, params }: PanelOptions, inner: Function) {
            const group = xnew((unit: Unit) => {
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
            return field(key, value, items[0] ?? '', Select, { items });
        },
        range(key: string, { value, min = 0, max = 100, step = 1 }: { value?: number, min?: number, max?: number, step?: number } = {}) {
            return field(key, value, min, Range, { min, max, step });
        },
        checkbox(key: string, { value }: { value?: boolean } = {}) {
            return field(key, value, false, Checkbox, {});
        },
        separator() {
            xnew(Separator);
        }
    }
}

function Group(group: Unit, { name, open = false }: { name?: string, open?: boolean }) {
    const openAndClose = xnew.extend(OpenAndClose, { open });
    if (name) {
        xnew('<div style="height: 2em; margin: 0.125em 0; display: flex; align-items: center; cursor: pointer; user-select: none;">', (unit: Unit) => {
            unit.on('click', () => openAndClose.toggle());
            xnew((unit: Unit) => {
                xnew.extend(SVG, { viewBox: '0 0 12 12', stroke: 'currentColor', style: 'width: 1em; height: 1em; margin-right: 0.25em;' });
                xnew('<path d="M6 2 10 6 6 10"/>');
                group.on('-transition', ({ value }: { value: number }) => unit.element.style.transform = `rotate(${value * 90}deg)`);
            });
            xnew('<div>', name);
        });
    }
    xnew.extend(Accordion);
}

function Button(unit: Unit, { key = '' }: { key?: string }) {
    xnew.nest('<button style="margin: 0.125em 0; height: 2em; border: 1px solid; border-radius: 0.25em; cursor: pointer;">');
    
    unit.element.textContent = key;
    unit.on('pointerover', () => {
        Object.assign(unit.element.style, { background: paleColor, borderColor: 'currentColor' });
    });
    unit.on('pointerout', () => {
        Object.assign(unit.element.style, { background: '', borderColor: '' });
    });
    unit.on('pointerdown', () => {
        unit.element.style.filter = 'brightness(0.5)';
    });
    unit.on('pointerup', () => {
        unit.element.style.filter = '';
    });
}

function Separator(unit: Unit) {
    xnew.nest(`<div style="margin: 0.5em 0; border-top: 1px solid currentColor;">`);
}

function Range(unit: Unit,
    { key = '', value, min = 0, max = 100, step = 1 }:
    { key?: string, value?: number, min?: number, max?: number, step?: number }
) {
    value = value ?? min;

    xnew.nest(`<div style="position: relative; height: 2em; margin: 0.125em 0; cursor: pointer; user-select: none;">`);

    // fill bar
    const ratio = (value - min) / (max - min);
    const fill = xnew(`<div style="position: absolute; top: 0; left: 0; bottom: 0; width: ${ratio * 100}%; background: ${paleColor}; border: 1px solid currentColor; border-radius: 0.25em; transition: width 0.05s;">`);

    // overlay labels
    const status = xnew('<div style="position: absolute; inset: 0; padding: 0 0.5em; display: flex; justify-content: space-between; align-items: center; pointer-events: none;">', (unit: Unit) => {
        xnew('<div>', key);
        xnew('<div key="status">', value);
    });

    // hidden native input for interaction
    xnew.nest(`<input type="range" name="${key}" min="${min}" max="${max}" step="${step}" value="${value}" style="${hiddenInput}">`);

    unit.on('input', ({ event }: { event: Event }) => {
        const v = Number((event.target as HTMLInputElement).value);
        const r = (v - min) / (max - min);
        fill.element.style.width = `${r * 100}%`;
        status.element.querySelector('[key="status"]')!.textContent = String(v);
    });
}

function Checkbox(unit: Unit, { key = '', value }: { key?: string, value?: boolean } = {}) {
    xnew.nest(`<div style="position: relative; height: 2em; margin: 0.125em 0; padding: 0 0.5em; display: flex; align-items: center; cursor: pointer; user-select: none;">`);

    xnew('<div style="flex: 1;">', key);

    const box = xnew(`<div style="width: 1.25em; height: 1.25em; border: 1px solid currentColor; border-radius: 0.25em; display: flex; align-items: center; justify-content: center;">`, () => {
        xnew((unit: Unit) => {
            xnew.extend(SVG, { viewBox: '0 0 12 12', style: 'width: 1.25em; height: 1.25em; opacity: 0;', stroke: 'currentColor', strokeWidth: 2 });
            xnew('<path d="M2 6 5 9 10 3" />');
        });
    });
    const check = box.element.querySelector('svg') as SVGElement;

    const update = (checked: boolean) => {
        box.element.style.background = checked ? paleColor : '';
        check.style.opacity = checked ? '1' : '0';
    };
    update(!!value);
    xnew.nest(`<input type="checkbox" name="${key}" ${value ? 'checked' : ''} style="${hiddenInput}">`);
    unit.on('input', ({ value }: { value: boolean }) => {
        update(value);
    });
}

function Select(_: Unit, { key = '', value, items = [] }: { key?: string, value?: string, items?: string[] } = {}) {
    const initial = value ?? items[0] ?? '';

    xnew.nest(`<div style="position: relative; height: 2em; margin: 0.125em 0; padding: 0 0.5em; display: flex; align-items: center;">`);
    xnew('<div style="flex: 1;">', key);

    const native = xnew(`<select name="${key}" style="display: none;">`, () => {
        for (const item of items) {
            xnew(`<option value="${item}" ${item === initial ? 'selected' : ''}>`, item);
        }
    });

    const button = xnew(`<div style="height: 2em; padding: 0 1.5em 0 0.5em; display: flex; align-items: center; border: 1px solid currentColor; border-radius: 0.25em; cursor: pointer; user-select: none; min-width: 3em; white-space: nowrap;">`, initial);

    xnew((unit: Unit) => {
        xnew.extend(SVG, { viewBox: '0 0 12 12', stroke: 'currentColor', strokeWidth: 2, style: 'position: absolute; right: 1.0em; width: 0.75em; height: 0.75em; pointer-events: none;' });
        xnew('<path d="M2 4 6 8 10 4" />');
    });
    
    button.on('click', () => {
        xnew((list: Unit) => {
            xnew(OpenAndClose, { open: false });
            xnew.extend(Popup);
            
            xnew.nest('<div style="position: absolute; padding: 0.25em 0;">');
            list.on('update', () => {
                const rect = button.element.getBoundingClientRect();
                list.element.style.right = (window.innerWidth - rect.right) + 'px';
                list.element.style.top = rect.bottom + 'px';
                list.element.style.background = getEffectiveBg(button.element);
            });

            xnew.extend(Accordion);
            xnew.nest(`<div style="position: relative; border: 1px solid currentColor; border-radius: 0.25em; overflow: hidden;">`);

            for (const item of items) {
                const div = xnew(`<div style="height: 2em; padding: 0 0.5em; display: flex; align-items: center; cursor: pointer; user-select: none;">`, item);
                div.on('pointerover', () => div.element.style.background = paleColor);
                div.on('pointerout', () => div.element.style.background = '');
                div.on('click', () => {
                    button.element.textContent = item;
                    (native.element as HTMLSelectElement).value = item;
                    native.element.dispatchEvent(new Event('input', { bubbles: false }));
                    list.finalize();
                });
            }
            list.on('click.outside', () => list.finalize());
        });
    });

    xnew.nest(native.element);

    function getEffectiveBg(element: Element): string {
        let current: Element | null = element.parentElement;
        while (current) {
            const bg = getComputedStyle(current).backgroundColor;
            if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
            current = current.parentElement;
        }
        return 'Canvas';
    }
}

