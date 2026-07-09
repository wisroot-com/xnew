//----------------------------------------------------------------------------------------------------
// InputSelect — listbox-style pulldown backed by a hidden native <select>
//
// A framed button (current value + up/down chevron) opens a floating option list styled like the
// other Input* elements — the native popup cannot be styled — while the hidden select keeps
// native form semantics.
//
// - InputSelect : component({ value, items, name, className, style }) — emits 'input' with { value } (string)
//
// Usage: const sel = xnew('<div style="width: 8em; height: 2em;">', xbasics.InputSelect, { items: ['low', 'mid', 'high'] });
//        sel.on('input', ({ value }) => ...);
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { sharedCss } from '../styles';
import { SVG } from './SVG';

export function InputSelect(unit: xnew.Unit,
    { value, items = [], name = '', className = '', style = '' }:
    { value?: string, items?: string[], name?: string, className?: string, style?: string } = {}
) {
    const initial = value ?? items[0] ?? '';
    const cls = xnew.css(sharedCss);

    xnew.nest(`<div class="${cls.frame} ${cls.clickable} ${cls.hover} ${className}" style="position: relative; box-sizing: border-box; width: 100%; height: 100%; display: flex; align-items: center; ${style}">`);
    const frame = unit.element as HTMLElement;

    const label = xnew('<div style="flex: 1 1 0; padding: 0 0.5em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">', initial);

    xnew(() => {
        xnew.extend(SVG, { viewBox: '0 0 12 12', stroke: 'currentColor', style: 'flex: none; width: 0.9em; height: 0.9em; margin-right: 0.5em;' });
        xnew('<path d="M3.5 4.5 6 2 8.5 4.5 M3.5 7.5 6 10 8.5 7.5"/>');
    });

    let select: HTMLSelectElement;
    let dropdown: xnew.Unit | null = null;

    const closeDropdown = () => {
        dropdown?.finalize();
        dropdown = null;
    };
    const openDropdown = () => {
        // bound to the frame element (not the current hidden select) so the list lands beside the button
        dropdown = xnew(frame, (list: xnew.Unit) => {
            // registered while the list's element is still the frame, so 'outside' means outside the whole control
            list.on('pointerdown.outside', () => closeDropdown());

            // Canvas keeps the floating list opaque over whatever sits behind the control
            xnew.nest(`<div class="${cls.frame} ${cls.scroll}" style="position: absolute; top: calc(100% + 0.25em); left: 0; right: 0; z-index: 1000; max-height: 12em; background: Canvas;">`);
            for (const item of items) {
                const option = xnew(`<div class="${cls.clickable} ${cls.hover}${item === select.value ? ` ${cls.pale}` : ''}" style="height: 2em; padding: 0 0.5em; display: flex; align-items: center; white-space: nowrap;">`, item);
                option.on('click', ({ event }: { event: PointerEvent }) => {
                    // keep the bubble from reaching the frame's toggle below
                    event.stopPropagation();
                    select.value = item;
                    select.dispatchEvent(new Event('input', { bubbles: false }));
                    closeDropdown();
                });
            }
        });
    };

    // registered while the unit's element is still the frame, so the whole button surface toggles
    unit.on('click', () => {
        if (dropdown === null) {
            openDropdown();
        } else {
            closeDropdown();
        }
    });

    xnew.nest(`<select${name ? ` name="${name}"` : ''} style="display: none;">`);
    for (const item of items) {
        xnew(`<option value="${item}"${item === initial ? ' selected' : ''}>`, item);
    }
    select = unit.element as HTMLSelectElement;

    unit.on('input', ({ value }: { value: string }) => {
        label.element.textContent = value;
    });
}
