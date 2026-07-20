//----------------------------------------------------------------------------------------------------
// InputRadio — one exclusive radio segment: a <label> wrapping a hidden native <input type="radio">
// Grouping is native: give sibling InputRadios a shared `name`. The checked tint is a pure CSS
// :has(input:checked) rule, so there is no JS selection state to coordinate.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';

export function InputRadio(unit: xnew.Unit,
    { value = '', name = '', checked = false, className = '', style = '', ...others }:
    { value?: string, name?: string, checked?: boolean, className?: string, style?: string, [key: string]: any } = {}
) {
    const css = xnew.css('base', {
        container: `
                padding: 0.25em 0.5em;
                flex: 1 1 0;
                display: flex; align-items: center; justify-content: center;
                white-space: nowrap;
                cursor: pointer; user-select: none;
                & + & { border-left: 1px solid currentColor; }
                &:hover { background: color-mix(in srgb, currentColor 20%, transparent); }
                &:has(input:checked) { background: color-mix(in srgb, currentColor 20%, transparent); }
            `,
        input: `
                width: 0; height: 0; margin: 0; opacity: 0;
            `,
    });

    xnew.nest({ tag: 'label', className: `${css.container} ${className}`, style }, value);
    const input = xnew({ tag: 'input', type: 'radio', name, value, checked, className: css.input, ...others });
}
