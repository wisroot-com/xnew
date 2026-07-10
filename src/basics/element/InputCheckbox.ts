//----------------------------------------------------------------------------------------------------
// InputCheckbox — framed check box backed by a hidden native <input type="checkbox">
//
// The invisible native control captures interaction (click / keyboard) while the visible surface
// is a framed box with an SVG check mark, so callers get a styled checkbox with native semantics.
//
// - InputCheckbox : component({ value, name, className, style })
//                   — emits 'input' with { value } (boolean checked state)
//
// Usage: const check = xnew('<div style="width: 1.25em; height: 1.25em;">', xbasics.InputCheckbox, { value: true });
//        check.on('input', ({ value }) => ...);
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { SVG } from './SVG';

export function InputCheckbox(unit: xnew.Unit,
    { value = false, name = '', className = '', style = '' }:
    { value?: boolean, name?: string, className?: string, style?: string } = {}
) {
    const cls = xnew.css`@layer xnew {
        .$fill { box-sizing: border-box; width: 100%; height: 100%; }
        .$clickable { cursor: pointer; user-select: none; }
        .$frame { border: 1px solid currentColor; border-radius: 0.25em; }
        .$tint { background: color-mix(in srgb, currentColor 20%, transparent); }
    }`;

    xnew.nest(`<div class="${cls.fill} ${cls.clickable} ${cls.frame} ${className}" style="position: relative; display: flex; align-items: center; justify-content: center; ${style}">`);
    const box = unit.element;

    // check mark (transparent while unchecked)
    const check = xnew((unit: xnew.Unit) => {
        xnew.extend(SVG, { viewBox: '0 0 12 12', style: 'width: 100%; height: 100%;', stroke: 'currentColor', strokeWidth: 2 });
        xnew('<path d="M2 6 5 9 10 3"/>');
    });

    const update = (checked: boolean) => {
        box.classList.toggle(cls.tint, checked);
        check.element.style.opacity = checked ? '1' : '0';
    };
    update(value);

    // hidden native input for interaction
    xnew.nest(`<input type="checkbox"${name ? ` name="${name}"` : ''}${value ? ' checked' : ''} style="position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; margin: 0;">`);
    unit.on('input', ({ value }: { value: boolean }) => {
        update(value);
    });
}
