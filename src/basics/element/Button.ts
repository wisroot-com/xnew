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
        // inline-flex flows like a native control and centers the label; max-width: stretch sizes the margin box, so any horizontal margin never overflows the parent
        button: {
            layer: 'base',
            body: `
                box-sizing: border-box;
                display: inline-flex; justify-content: center; align-items: center;
                width: 10em; max-width: -webkit-fill-available; max-width: -moz-available; max-width: stretch; height: 1.8em; margin: 0.125em;
                padding: 0 0.5em;
                background: transparent; color: inherit; font: inherit;
                border: 1px solid currentColor; border-radius: 0.25em;
                cursor: pointer; user-select: none;
                &:hover { background: color-mix(in srgb, currentColor 20%, transparent); }
                &:active { filter: brightness(0.5); }
            `,
        },
    });

    xnew.nest({ tag: 'button', type: 'button', className: `${css.button} ${className}`, style, ...others }, text);
}
