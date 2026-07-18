//----------------------------------------------------------------------------------------------------
// InputText — framed native text field that inherits the surrounding look
// The native <input> is the element itself: transparent, framed, matching the other Input*
// elements.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';

export function InputText(unit: xnew.Unit,
    { value, className = '', style = '', ...others }:
    { value?: string, className?: string, style?: string, [key: string]: any } = {}
) {
    const css = xnew.css({
        // max-width: stretch sizes the margin box, so any horizontal margin never overflows the parent
        input: {
            layer: 'base',
            body: `
                width: 10em; max-width: -webkit-fill-available; max-width: -moz-available; max-width: stretch; height: 1.8em;
                margin: 0.125em 0; padding: 0 0.5em;
                background: transparent; color: inherit; font: inherit;
                border: 1px solid currentColor; border-radius: 0.25em;
                outline: none;
                &:focus { background: color-mix(in srgb, currentColor 20%, transparent); }
            `,
        },
    });

    xnew.nest({ tag: 'input', type: 'text', value, className: `${css.input} ${className}`, style, ...others });
    return {
        get value() {
            return (unit.element as HTMLInputElement).value;
        }
    }
}
