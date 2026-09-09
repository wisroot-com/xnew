//----------------------------------------------------------------------------------------------------
// InputField — the framed single-line native field: Field, the shared core, with InputText / InputNumber over it
// The container owns the border / spacing and routes clicks to the inner transparent <input>; the value type
// belongs to the host, so each reads / writes its own `.value` (a set fires the native input + change pair).
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { dispatchCommit } from '../../utils/dom';
import { clamp } from '../../utils/math';

//----------------------------------------------------------------------------------------------------
// Field — the shared core: the frame and the transparent input inside it, with `type` left to the host
// It owns no value semantics; `.input` is the raw element every host reads and writes through.
//----------------------------------------------------------------------------------------------------

function Field(unit: xnew.Unit,
    { type, value, disabled = false, className = '', style = '', ...others }:
    { type: string, value?: string | number, disabled?: boolean, className?: string, style?: string, [key: string]: any }
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
        // the native spinner is unstylable, so a number field drops it here and centres its digits instead
        number: `
            text-align: center;
            -moz-appearance: textfield; appearance: textfield;
            &::-webkit-inner-spin-button, &::-webkit-outer-spin-button { -webkit-appearance: none; appearance: none; margin: 0; }
        `,
    });

    xnew.nest({ tag: 'div', className: `${css.container} ${className}`, style, 'data-disabled': disabled === true ? '' : undefined });

    const input = xnew({ tag: 'input', type, value, disabled, className: `${css.input} ${type === 'number' ? css.number : ''}`, ...others });

    // clicking the container padding routes focus to the inner input
    unit.on('click', () => input.current.focus());

    return {
        get input() {
            return input.current as HTMLInputElement;
        },
    };
}

//----------------------------------------------------------------------------------------------------
// InputText — the string host: `.value` is the field text as typed
//----------------------------------------------------------------------------------------------------

export function InputText(unit: xnew.Unit,
    { value, disabled = false, className = '', style = '', ...others }:
    { value?: string, disabled?: boolean, className?: string, style?: string, [key: string]: any } = {}
) {
    const field = xnew.extend(Field, { type: 'text', value, disabled, className, style, ...others }) as { input: HTMLInputElement };

    return {
        get value() {
            return field.input.value;
        },
        set value(text: string) {
            field.input.value = text;
            dispatchCommit(field.input, text);
        },
    };
}

//----------------------------------------------------------------------------------------------------
// InputNumber — the number host: `.value` is NaN while the field is empty
//----------------------------------------------------------------------------------------------------

export function InputNumber(unit: xnew.Unit,
    { value, disabled = false, className = '', style = '', ...others }:
    { value?: number, disabled?: boolean, className?: string, style?: string, [key: string]: any } = {}
) {
    const field = xnew.extend(Field, { type: 'number', value, disabled, className, style, ...others }) as { input: HTMLInputElement };

    return {
        get value() {
            return field.input.valueAsNumber;
        },
        // a native number field keeps an out-of-range assignment (it only marks itself invalid), so the bounds ride here, read back off the element
        set value(number: number) {
            const element = field.input;
            const low = element.min !== '' ? Number(element.min) : -Infinity;
            const high = element.max !== '' ? Number(element.max) : Infinity;
            element.value = String(clamp(number, low, high));
            dispatchCommit(element, element.valueAsNumber);
        },
    };
}
