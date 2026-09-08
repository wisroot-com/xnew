//----------------------------------------------------------------------------------------------------
// InputText — native text field wrapped in a framed container
// The container owns the border / spacing and routes clicks to the inner transparent <input>.
// Hosts read / write the string through `.value` (a set fires the native `input` + `change` pair);
// `.input` is the escape hatch to the raw element.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { dispatchCommit } from '../../utils/dom';

export function InputText(unit: xnew.Unit,
    { value, disabled = false, className = '', style = '', ...others }:
    { value?: string, disabled?: boolean, className?: string, style?: string, [key: string]: any } = {}
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
            &:focus-visible, &:has(:focus-visible) { outline: 2px solid currentColor; outline-offset: 1px; }
            &[data-disabled] { opacity: 0.5; cursor: default; pointer-events: none; }
        `,
        input: `
            width: 100%; height: 100%;
            margin: 0; padding: 0;
            background: transparent; color: inherit; font: inherit;
            border: none; outline: none;
        `,
    });

    xnew.nest({ tag: 'div', className: `${css.container} ${className}`, style, 'data-disabled': disabled === true ? '' : undefined });

    const input = xnew({ tag: 'input', type: 'text', value, disabled, className: css.input, ...others });

    // clicking the container padding routes focus to the inner input
    unit.on('click', () => input.current.focus());

    return {
        get value() {
            return (input.current as HTMLInputElement).value;
        },
        set value(text: string) {
            const element = input.current as HTMLInputElement;
            element.value = text;
            dispatchCommit(element, text);
        },
        get input() {
            return input.current as HTMLInputElement;
        },
    };
}
