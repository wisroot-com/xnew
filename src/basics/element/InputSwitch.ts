//----------------------------------------------------------------------------------------------------
// InputSwitch — sliding on / off switch backed by a hidden native <input type="checkbox">
// unit.current is the container; standalone it draws the default Knob, else a compose fn styles itself
// off `data-checked`; write through `.value` (never `.input.checked` — it fires nothing).
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { dispatchCommit } from '../../utils/dom';

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
            &[data-checked] { background: color-mix(in srgb, currentColor 20%, transparent); }
            &[data-disabled] { opacity: 0.5; cursor: default; pointer-events: none; }
        `,
        input: `
            width: 0; height: 0; margin: 0; opacity: 0;
        `,
    });

    const container = xnew.nest({ tag: 'label', className: `${css.container} ${className}`, style, 'data-disabled': disabled === true ? '' : undefined }) as HTMLElement;

    const input = xnew({ tag: 'input', type: 'checkbox', checked: value, disabled, className: css.input, ...others });

    // the hidden input holds the state (read through `input`); the container attribute only drives the look
    function apply(checked: boolean) {
        (input.current as HTMLInputElement).checked = checked;
        container.toggleAttribute('data-checked', checked);
    }
    apply(value);

    // the setter's own dispatch re-enters here, which is harmless: it re-applies the value already applied
    input.on('input', ({ value }: { value: boolean }) => apply(value));

    xnew.standalone(() => {
        xnew(Knob);
    });

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
