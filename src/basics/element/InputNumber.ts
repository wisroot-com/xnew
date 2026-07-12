//----------------------------------------------------------------------------------------------------
// InputNumber — framed native number field
// The unstylable native spinner is hidden so the field matches the other Input* elements
// (keyboard arrows still step the value).
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';

export function InputNumber(unit: xnew.Unit,
    { className = '', style = '', ...others }:
    { className?: string, style?: string, [key: string]: any } = {}
) {
    const css = xnew.css({
        // inline-block flows like a native control; max-width: stretch sizes the margin box, so any horizontal margin never overflows the parent
        field: {
            layer: 'base',
            body: `
                box-sizing: border-box;
                display: inline-block;
                width: 10em; max-width: -webkit-fill-available; max-width: -moz-available; max-width: stretch; height: 1.8em; margin: 0.125em 0;
                text-align: center; padding: 0 0.5em;
                background: transparent; color: inherit; font: inherit;
                border: 1px solid currentColor; border-radius: 0.25em;
                outline: none;
                -moz-appearance: textfield; appearance: textfield;
                &::-webkit-inner-spin-button, &::-webkit-outer-spin-button { -webkit-appearance: none; appearance: none; margin: 0; }
                &:focus { background: color-mix(in srgb, currentColor 20%, transparent); }
            `,
        },
    });

    xnew.nest({ tag: 'input', type: 'number', className: `${css.field} ${className}`, style, ...others });
}
