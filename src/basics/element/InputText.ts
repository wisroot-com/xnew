//----------------------------------------------------------------------------------------------------
// InputText — native text field wrapped in a framed container
// The container owns the border / spacing and routes clicks to the inner transparent <input>.
// Hosts read / write the string through `.value`; `.input` is the escape hatch to the raw element.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';

export function InputText(unit: xnew.Unit,
    { value, className = '', style = '', ...others }:
    { value?: string, className?: string, style?: string, [key: string]: any } = {}
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
            background: transparent; color: inherit; font: inherit;
            border: none; outline: none;
        `,
    });

    xnew.nest({ tag: 'div', className: `${css.container} ${className}`, style });

    const input = xnew({ tag: 'input', type: 'text', value, className: css.input, ...others });

    // clicking the container padding routes focus to the inner input
    unit.on('click', () => input.current.focus());

    return {
        get value() {
            return (input.current as HTMLInputElement).value;
        },
        set value(text: string) {
            (input.current as HTMLInputElement).value = text;
        },
        get input() {
            return input.current as HTMLInputElement;
        },
    };
}
