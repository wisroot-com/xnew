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
import { sharedCss } from '../styles';
import { SVG } from './SVG';

export function InputCheckbox(unit: xnew.Unit,
    { value = false, name = '', className = '', style = '' }:
    { value?: boolean, name?: string, className?: string, style?: string } = {}
) {
    const cls = xnew.css(sharedCss);

    xnew.nest(`<div class="${cls.clickable} ${cls.frame} ${className}" style="position: relative; box-sizing: border-box; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; ${style}">`);
    const box = unit.element;

    // check mark (transparent while unchecked)
    const check = xnew((unit: xnew.Unit) => {
        xnew.extend(SVG, { viewBox: '0 0 12 12', style: 'width: 100%; height: 100%;', stroke: 'currentColor', strokeWidth: 2 });
        xnew('<path d="M2 6 5 9 10 3"/>');
    });

    const update = (checked: boolean) => {
        box.classList.toggle(cls.pale, checked);
        check.element.style.opacity = checked ? '1' : '0';
    };
    update(value);

    // hidden native input for interaction
    xnew.nest(`<input type="checkbox"${name ? ` name="${name}"` : ''}${value ? ' checked' : ''} class="${cls.hiddenInput}">`);
    unit.on('input', ({ value }: { value: boolean }) => {
        update(value);
    });
}
