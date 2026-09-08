//----------------------------------------------------------------------------------------------------
// InputRadio — one exclusive radio segment: a <label> wrapping a hidden native <input type="radio">
// Grouping is native: give sibling InputRadios a shared `name`. The checked tint is a pure CSS
// :has(input:checked) rule, so there is no JS selection state to coordinate.
// `.value` reads this segment's own value (fixed at creation); `.checked` is the mutable state — setting it
// unchecks the group's siblings natively. There is no group-level value getter; read it off the checked segment.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { dispatchCommit } from '../../utils/dom';

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

    return {
        get value() {
            return (input.current as HTMLInputElement).value;
        },
        get checked() {
            return (input.current as HTMLInputElement).checked;
        },
        set checked(current: boolean) {
            const element = input.current as HTMLInputElement;
            element.checked = current;
            dispatchCommit(element, current);
        },
        get input() {
            return input.current as HTMLInputElement;
        },
    };
}
