//----------------------------------------------------------------------------------------------------
// InputSwitch — sliding on / off switch; the state machinery is Toggle, this file is the track's look
// unit.current is the container; standalone it draws the default Knob, else a compose fn styles itself
// off `data-checked`; write through `.value` (never `.input.checked` — it fires nothing).
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { Toggle } from './Toggle';

export function InputSwitch(unit: xnew.Unit,
    { className = '', ...others }:
    { value?: boolean, disabled?: boolean, className?: string, style?: string, [key: string]: any } = {}
) {
    const css = xnew.css('base', {
        container: `
            display: inline-block;
            width: 3em; max-width: -webkit-fill-available; max-width: -moz-available; max-width: stretch; height: 1.5em; margin: 0.125em 0;
            position: relative;
            border: 1px solid currentColor; border-radius: 1em;
            cursor: pointer; user-select: none;
            &:hover { background: color-mix(in srgb, currentColor 10%, transparent); }
            &[data-checked] { background: color-mix(in srgb, currentColor 20%, transparent); }
            &[data-checked]:hover { background: color-mix(in srgb, currentColor 30%, transparent); }
            &:focus-visible, &:has(:focus-visible) { outline: 2px solid currentColor; outline-offset: 1px; }
            &[data-disabled] { opacity: 0.5; cursor: default; pointer-events: none; }
        `,
    });

    xnew.extend(Toggle, { className: `${css.container} ${className}`, ...others });

    xnew.standalone(() => {
        xnew(Knob);
    });
}

//----------------------------------------------------------------------------------------------------
// Knob — the sliding indicator; rides to the far side while the container is data-checked
//----------------------------------------------------------------------------------------------------

function Knob() {
    const css = xnew.css('base', {
        container: `
            position: absolute; top: 0.15em; bottom: 0.15em; left: 0.15em;
            aspect-ratio: 1 / 1; border-radius: 50%;
            background: currentColor;
            transition: left 0.15s, transform 0.15s;
            [data-checked] > & { left: calc(100% - 0.15em); transform: translateX(-100%); }
        `,
    });

    xnew.nest({ tag: 'div', className: css.container });
}
