//----------------------------------------------------------------------------------------------------
// InputCheckbox — framed check box backed by a hidden native <input type="checkbox">
// unit.current is the container (not the input), so a trailing compose fn nests inside it and styles
// itself off `data-checked`; write through `.value` (never `.input.checked` — it fires nothing).
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { dispatchCommit } from '../../utils/dom';

export function InputCheckbox(unit: xnew.Unit,
    { value = false, disabled = false, className = '', style = '', ...others }:
    { value?: boolean, disabled?: boolean, className?: string, style?: string, [key: string]: any } = {}
) {
    const css = xnew.css('base', {
        container: `
            display: inline-block;
            width: 1.5em; height: 1.5em; margin: 0.125em;
            position: relative;
            border: 1px solid currentColor; border-radius: 0.25em;
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

    // bound to the input, not the container: the setter dispatches on the container, so its own event cannot re-enter here
    input.on('input', ({ value }: { value: boolean }) => apply(value));

    xnew.standalone(() => {
        xnew(CheckMark);
    });

    return {
        get value() {
            return (input.current as HTMLInputElement).checked;
        },
        // announced on the container, which is also where a host listens, so a programmatic set reads like an interaction
        set value(checked: boolean) {
            apply(checked);
            dispatchCommit(container, checked);
        },
        get input() {
            return input.current as HTMLInputElement;
        },
    };
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
