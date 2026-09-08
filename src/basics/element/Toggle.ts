//----------------------------------------------------------------------------------------------------
// Toggle — the shared core of InputCheckbox / InputSwitch: a hidden native checkbox mirrored as data-checked
// Holds no look of its own: the host extends it and passes the container's className, then draws the
// mark / knob that styles itself off `[data-checked] > &`. unit.current ends on the container.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { dispatchCommit } from '../../utils/dom';

export function Toggle(unit: xnew.Unit,
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
