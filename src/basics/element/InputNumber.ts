//----------------------------------------------------------------------------------------------------
// InputNumber — native number field wrapped in a framed container
// The container owns the border / spacing and routes clicks to the inner transparent <input>;
// the unstylable native spinner is hidden so the field matches the other Input* elements.
// Hosts read / write the number through `.value` (NaN while the field is empty; a set fires the native
// `input` + `change` pair); `.input` is the raw element.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { dispatchCommit } from '../../utils/dom';

export function InputNumber(unit: xnew.Unit,
    { value, className = '', style = '', ...others }:
    { value?: number, className?: string, style?: string, [key: string]: any } = {}
) {
    const css = xnew.css('base', {
        container: `
            display: inline-flex; align-items: center;
            box-sizing: border-box;
            width: 10em; max-width: -webkit-fill-available; max-width: -moz-available; max-width: stretch; height: 1.8em;
            margin: 0.125em 0; padding: 0 0.5em;
            border: 1px solid currentColor; border-radius: 0.25em;
            cursor: text;
            &:focus-within { background: color-mix(in srgb, currentColor 20%, transparent); }
        `,
        input: `
            width: 100%; height: 100%;
            margin: 0; padding: 0;
            text-align: center;
            background: transparent; color: inherit; font: inherit;
            border: none; outline: none;
            -moz-appearance: textfield; appearance: textfield;
            &::-webkit-inner-spin-button, &::-webkit-outer-spin-button { -webkit-appearance: none; appearance: none; margin: 0; }
        `,
    });

    xnew.nest({ tag: 'div', className: `${css.container} ${className}`, style });

    const input = xnew({ tag: 'input', type: 'number', value, className: css.input, ...others });

    // clicking the container padding routes focus to the inner input
    unit.on('click', () => input.current.focus());

    return {
        get value() {
            return (input.current as HTMLInputElement).valueAsNumber;
        },
        set value(number: number) {
            const element = input.current as HTMLInputElement;
            element.value = String(number);
            dispatchCommit(element, number);
        },
        get input() {
            return input.current as HTMLInputElement;
        },
    };
}
