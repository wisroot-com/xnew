//----------------------------------------------------------------------------------------------------
// InputSelect — listbox-style pulldown backed by a hidden native <select>
//
// A framed button (current value + down chevron) opens a floating option list styled like the
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

    xnew.nest(`<div class="${cls.fill} ${cls.frame} ${cls.clickable} ${cls.hover} ${className}" style="position: relative; display: flex; align-items: center; ${style}">`);
    const frame = unit.element as HTMLElement;

    const labelBox = xnew('<div style="flex: 1 1 0; min-width: 0; padding: 0 0.5em;">');
    const label = xnew(labelBox, '<div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">', initial);
    // invisible sizers: every item reserves its own width, so the button fits the longest one
    for (const item of items) {
        xnew(labelBox, '<div style="visibility: hidden; height: 0; white-space: nowrap;">', item);
    }

    xnew(() => {
        xnew.extend(SVG, { viewBox: '0 0 12 12', stroke: 'currentColor', style: 'flex: none; width: 0.9em; height: 0.9em; margin-right: 0.5em;' });
        xnew('<path d="M3.5 4.5 6 7.5 8.5 4.5"/>');
    });

    let select: HTMLSelectElement;
    let dropdown: xnew.Unit | null = null;

    // the floating list wears the surface color behind the control (the button face is transparent,
    // and reading the frame itself would capture its hover tint)
    const surfaceColor = () => {
        for (let element = frame.parentElement; element !== null; element = element.parentElement) {
            const color = getComputedStyle(element).backgroundColor;
            if (color !== '' && color !== 'transparent' && color !== 'rgba(0, 0, 0, 0)') {
                return color;
            }
        }
        return 'Canvas';
    };

    const closeDropdown = () => {
        dropdown?.finalize();
        dropdown = null;
    };
    const openDropdown = () => {
        // bound to the frame element (not the current hidden select) so the list lands beside the button
        dropdown = xnew(frame, (list: xnew.Unit) => {
            // the button hover tint is suppressed while the list is open, restored on any close path
            frame.classList.remove(cls.hover);
            list.on('finalize', () => frame.classList.add(cls.hover));

            // registered while the list's element is still the frame, so 'outside' means outside the whole control
            list.on('pointerdown.outside', () => closeDropdown());

            // fixed + viewport coords escape overflow-clipping ancestors (e.g. a panel's scroll container);
            // max-content lets the list outgrow the button so long items stay readable
            const menu = xnew.nest(`<div class="${cls.frame} ${cls.scroll}" style="position: fixed; margin-top: 0.25em; width: max-content; z-index: 1000; max-height: 12em; border-radius: 0; background: ${surfaceColor()};">`) as HTMLElement;

            // re-anchored every frame, so scrolling never shifts the list off the button
            const anchor = () => {
                const rect = frame.getBoundingClientRect();
                menu.style.left = `${rect.left}px`;
                menu.style.top = `${rect.bottom}px`;
                menu.style.minWidth = `${rect.width}px`;
            };
            anchor();
            list.on('update', anchor);
            for (const item of items) {
                const option = xnew(`<div class="${cls.clickable} ${cls.hover}${item === select.value ? ` ${cls.pale}` : ''}" style="height: 2em; padding: 0 0.5em; display: flex; align-items: center; white-space: nowrap;">`, item);
                option.on('click', ({ event }: { event: PointerEvent }) => {
                    // keep the bubble from reaching the frame's toggle below
                    event.stopPropagation();
                    select.value = item;
                    // bubbles like a native input event so hosts wrapping the control can listen above it
                    select.dispatchEvent(new Event('input', { bubbles: true }));
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
