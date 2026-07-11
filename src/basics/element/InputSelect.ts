//----------------------------------------------------------------------------------------------------
// InputSelect — listbox-style pulldown backed by a hidden native <select>
//
// A framed button (current value + down chevron) opens a floating option list styled like the
// other Input* elements — the native popup cannot be styled — while the hidden select keeps
// native form semantics.
// The open / selected looks live in css rules keyed on data-open / data-checked attributes,
// so designs stay intact.
//
// - InputSelect : component({ value, items, className, style, designs, ...rest }) — className /
//                 style decorate the container; designs: { frame?, label?, menu?, item? } — a
//                 Design ({ className?, style? }) per part; rest members (name, …) pass through
//                 to the <select>; emits 'input' with { value } (string); returns { get container }
//
// Usage: const sel = xnew(xbasics.InputSelect, { items: ['low', 'mid', 'high'] });
//        sel.on('input', ({ value }) => ...);
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { SVG } from './SVG';
import { Design } from '../design';

export function InputSelect(unit: xnew.Unit,
    { value, items = [], className = '', style = '', designs = {}, ...others }:
    { value?: string, items?: string[], className?: string, style?: string, designs?: { frame?: Design, label?: Design, menu?: Design, item?: Design }, [key: string]: any } = {}
) {
    const initial = value ?? items[0] ?? '';
    const cls = xnew.css({
        // sizing shell only; the default size is an overridable @layer base rule
        container: {
            layer: 'base',
            body: `
                box-sizing: border-box; width: 10rem; height: 1.8rem;
            `,
        },
        // framed button face (position: relative anchors nothing itself but keeps the click surface);
        // the hover tint is suppressed via data-open while the option list is open
        frame: {
            layer: 'base',
            body: `
                box-sizing: border-box; width: 100%; height: 100%;
                position: relative;
                display: flex; align-items: center;
                border: 1px solid currentColor; border-radius: 0.25em;
                cursor: pointer; user-select: none;
                &:not([data-open]):hover { background: color-mix(in srgb, currentColor 20%, transparent); }
            `,
        },
        // current value text clipped inside the button
        label: {
            layer: 'base',
            body: `
                white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            `,
        },
        // floating option list; fixed + viewport coords escape overflow-clipping ancestors
        // (e.g. a panel's scroll container), max-content lets it outgrow the button
        menu: {
            layer: 'base',
            body: `
                position: fixed; margin-top: 0.25em; width: max-content; z-index: 1000;
                max-height: 12em;
                border: 1px solid currentColor;
                overflow-y: auto; scrollbar-width: thin; scrollbar-color: color-mix(in srgb, currentColor 40%, transparent) transparent;
            `,
        },
        // one option row; the current selection is expressed via data-checked
        item: {
            layer: 'base',
            body: `
                height: 2em; padding: 0 0.5em;
                display: flex; align-items: center;
                white-space: nowrap;
                cursor: pointer; user-select: none;
                &:hover { background: color-mix(in srgb, currentColor 20%, transparent); }
                &[data-checked] { background: color-mix(in srgb, currentColor 20%, transparent); }
            `,
        },
    });

    const container = xnew.nest({ tag: 'div', className: `${cls.container} ${className}`, style });

    xnew.nest({ tag: 'div', className: `${cls.frame} ${designs.frame?.className ?? ''}`, style: designs.frame?.style });
    const frame = unit.element as HTMLElement;

    const labelBox = xnew('<div style="flex: 1 1 0; min-width: 0; padding: 0 0.5em;">');
    const label = xnew(labelBox, { tag: 'div', className: `${cls.label} ${designs.label?.className ?? ''}`, style: designs.label?.style }, initial);
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
            // data-open suppresses the button hover tint while the list is open, restored on any close path
            frame.toggleAttribute('data-open', true);
            list.on('finalize', () => frame.toggleAttribute('data-open', false));

            // registered while the list's element is still the frame, so 'outside' means outside the whole control
            list.on('pointerdown.outside', () => closeDropdown());

            const menu = xnew.nest({ tag: 'div', className: `${cls.menu} ${designs.menu?.className ?? ''}`, style: `background: ${surfaceColor()}; ${designs.menu?.style ?? ''}` });

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
                const option = xnew({ tag: 'div', className: `${cls.item} ${designs.item?.className ?? ''}`, style: designs.item?.style }, item);
                option.element.toggleAttribute('data-checked', item === select.value);
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

    xnew.nest({ tag: 'select', style: 'display: none;', ...others });
    for (const item of items) {
        xnew({ tag: 'option', value: item, selected: item === initial }, item);
    }
    select = unit.element as HTMLSelectElement;

    unit.on('input', ({ value }: { value: string }) => {
        label.element.textContent = value;
    });

    return { get container() { return container; } };
}
