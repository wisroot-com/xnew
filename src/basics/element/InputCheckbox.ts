//----------------------------------------------------------------------------------------------------
// InputCheckbox — framed check box; the state machinery is Toggle, this file is the box's look
// unit.current is the container (not the input), so a trailing compose fn nests inside it and styles
// itself off `data-checked`; write through `.value` (never `.input.checked` — it fires nothing).
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { Toggle } from './Toggle';

export function InputCheckbox(unit: xnew.Unit,
    { className = '', ...others }:
    { value?: boolean, disabled?: boolean, className?: string, style?: string, [key: string]: any } = {}
) {
    const css = xnew.css('base', {
        container: `
            display: inline-block;
            width: 1.5em; height: 1.5em; margin: 0.125em;
            position: relative;
            border: 1px solid currentColor; border-radius: 0.25em;
            cursor: pointer; user-select: none;
            &:hover { background: color-mix(in srgb, currentColor 10%, transparent); }
            &[data-checked] { background: color-mix(in srgb, currentColor 20%, transparent); }
            &[data-checked]:hover { background: color-mix(in srgb, currentColor 30%, transparent); }
            &[data-disabled] { opacity: 0.5; cursor: default; pointer-events: none; }
        `,
    });

    xnew.extend(Toggle, { className: `${css.container} ${className}`, ...others });

    xnew.standalone(() => {
        xnew(CheckMark);
    });
}

//----------------------------------------------------------------------------------------------------
// CheckMark — the default check svg drawn when the component is used standalone; shown while data-checked
//----------------------------------------------------------------------------------------------------

function CheckMark() {
    const css = xnew.css('base', {
        container: `
            box-sizing: border-box; position: absolute; inset: 0; width: 100%; height: 100%;
            stroke: currentColor; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round;
            fill: none;
            opacity: 0;
            [data-checked] > & { opacity: 1; }
        `,
    });

    xnew.nest({ tag: 'svg', viewBox: '0 0 12 12', className: css.container });
    xnew('<path d="M2 6 5 9 10 3"/>');
}
