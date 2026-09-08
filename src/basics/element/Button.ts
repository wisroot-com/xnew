//----------------------------------------------------------------------------------------------------
// Button — framed native button with centered label
// Gives a single button the same framed look as Panel's rows (frame + hover tint + press
// feedback) without pulling in the whole panel.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';

export function Button(unit: xnew.Unit,
    { text = '', disabled = false, className = '', style = '', ...others }:
    { text?: string, disabled?: boolean, className?: string, style?: string, [key: string]: any } = {}
) {
    const css = xnew.css('base', {
        container: `
            min-width: 6em; max-width: -webkit-fill-available; max-width: -moz-available; max-width: stretch; min-height: 1.8em;
            padding: 0 0.5em; margin: 0.125em 0;
            cursor: pointer; user-select: none;
            border: 1px solid currentColor; border-radius: 0.25em;
            &:hover { background: color-mix(in srgb, currentColor 10%, transparent); }
            &:active { filter: brightness(0.5); }
            &[data-disabled] { opacity: 0.5; cursor: default; pointer-events: none; }
        `,
    });

    xnew.nest({ tag: 'button', type: 'button', disabled, className: `${css.container} ${className}`, style, 'data-disabled': disabled === true ? '' : undefined, ...others }, text);
}
