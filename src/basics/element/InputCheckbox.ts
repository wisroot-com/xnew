//----------------------------------------------------------------------------------------------------
// InputCheckbox — framed check box, InputSwitch — sliding on / off switch, and Toggle, the state core both extend
// unit.current is the container (not the input), so a trailing compose fn nests inside it and styles
// itself off `data-checked`; write through `.value` (never `.input.checked` — it fires nothing).
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { dispatchCommit } from '../../utils/dom';

//----------------------------------------------------------------------------------------------------
// Toggle — the shared core: a hidden native checkbox mirrored as data-checked on the container
// Holds no look of its own: the host extends it and passes the container's className, then draws the
// mark / knob that styles itself off `[data-checked] > &`. unit.current ends on the container.
//----------------------------------------------------------------------------------------------------

function Toggle(unit: xnew.Unit,
    { value = false, disabled = false, className = '', style = '', ...others }:
    { value?: boolean, disabled?: boolean, className?: string, style?: string, [key: string]: any } = {}
) {
    const css = xnew.css('base', {
        input: `
            width: 0; height: 0; margin: 0; opacity: 0;
        `,
    });

    const container = xnew.nest({ tag: 'label', className, style, 'data-disabled': disabled === true ? '' : undefined }) as HTMLElement;

    const input = xnew({ tag: 'input', type: 'checkbox', checked: value, disabled, className: css.input, ...others });

    // the hidden input holds the state (read through `input`); the container attribute only drives the look
    function apply(checked: boolean) {
        (input.current as HTMLInputElement).checked = checked;
        container.toggleAttribute('data-checked', checked);
    }
    apply(value);

    // the setter's own dispatch re-enters here, which is harmless: it re-applies the value already applied
    input.on('input', ({ value }: { value: boolean }) => apply(value));

    return {
        get value() {
            return (input.current as HTMLInputElement).checked;
        },
        // announced on the input, as a user's click would, so `event.target` reads the same either way
        set value(checked: boolean) {
            apply(checked);
            dispatchCommit(input.current as HTMLInputElement, checked);
        },
        get input() {
            return input.current as HTMLInputElement;
        },
    };
}

//----------------------------------------------------------------------------------------------------
// InputCheckbox — the box's look; the state machinery is Toggle
//----------------------------------------------------------------------------------------------------

export function InputCheckbox(unit: xnew.Unit,
    { value = false, disabled = false, className = '', style = '', ...others }:
    { value?: boolean, disabled?: boolean, className?: string, style?: string, [key: string]: any } = {}
) {
    const css = xnew.css('base', {
        container: `
            display: inline-block;
            width: 1.5em; height: 1.5em; margin: 0.125em 0;
            position: relative;
            border: 1px solid currentColor; border-radius: 0.25em;
            cursor: pointer; user-select: none;
            &:hover { background: color-mix(in srgb, currentColor 10%, transparent); }
            &[data-checked] { background: color-mix(in srgb, currentColor 20%, transparent); }
            &[data-checked]:hover { background: color-mix(in srgb, currentColor 30%, transparent); }
            &:focus-visible, &:has(:focus-visible) { outline: 2px solid currentColor; outline-offset: 1px; }
            &[data-disabled] { opacity: 0.5; cursor: default; pointer-events: none; }
        `,
    });

    xnew.extend(Toggle, { value, disabled, className: `${css.container} ${className}`, style, ...others });

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

//----------------------------------------------------------------------------------------------------
// InputSwitch — the track's look; standalone it draws the default Knob, else a compose fn styles itself off `data-checked`
//----------------------------------------------------------------------------------------------------

export function InputSwitch(unit: xnew.Unit,
    { value = false, disabled = false, className = '', style = '', ...others }:
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

    xnew.extend(Toggle, { value, disabled, className: `${css.container} ${className}`, style, ...others });

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
