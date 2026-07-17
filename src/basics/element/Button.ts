//----------------------------------------------------------------------------------------------------
// Button — framed native button with centered label
// Gives a single button the same framed look as Panel's rows (frame + hover tint + press
// feedback) without pulling in the whole panel.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';

export function Button(unit: xnew.Unit,
    { text = '', className = '', style = '', ...others }:
    { text?: string, className?: string, style?: string, [key: string]: any } = {}
) {
    const css = xnew.css({
        // inline-flex centers the label while flowing like a native control; max-width: stretch sizes the margin box, so any horizontal margin never overflows the parent
        button: {
            layer: 'base',
            body: `
                min-width: 6em; max-width: -webkit-fill-available; max-width: -moz-available; max-width: stretch; min-height: 1.8em; margin: 0.125em;
                padding: 0 0.5em; margin: 0.125em;
                cursor: pointer; user-select: none;
                border: 1px solid currentColor; border-radius: 0.25em;
                &:hover { background: color-mix(in srgb, currentColor 20%, transparent); }
                &:active { filter: brightness(0.5); }
            `,
        },
    });

    xnew.nest({ tag: 'button', type: 'button', className: `${css.button} ${className}`, style, ...others }, text);
}
