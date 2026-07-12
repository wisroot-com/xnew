//----------------------------------------------------------------------------------------------------
// InputCheckbox — framed check box backed by a hidden native <input type="checkbox">
// The invisible native control captures interaction; the checked look lives in css rules keyed
// on a data-checked attribute, so caller styling stays intact.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';

export function InputCheckbox(unit: xnew.Unit,
    { value = false, className = '', style = '', ...others }:
    { value?: boolean, className?: string, style?: string, [key: string]: any } = {}
) {
    const css = xnew.css({
        // max-width: stretch sizes the margin box, so any horizontal margin never overflows the parent
        container: {
            layer: 'base',
            body: `
                box-sizing: border-box;
                display: inline-flex; align-items: center; justify-content: center;
                width: 1.5em; max-width: -webkit-fill-available; max-width: -moz-available; max-width: stretch; height: 1.5em; margin: 0.125em 0;
                position: relative;
                border: 1px solid currentColor; border-radius: 0.25em;
                user-select: none;
                svg { opacity: 0; }
                &[data-checked] { background: color-mix(in srgb, currentColor 20%, transparent); }
                &[data-checked] svg { opacity: 1; }
            `,
        },
        svg: {
            layer: 'base',
            body: `
                box-sizing: border-box; display: block; width: 100%; height: 100%;
                stroke: currentColor; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round;
                fill: none;
            `,
        },
        input: {
            layer: 'base',
            body: `
                position: absolute; inset: 0; width: 100%; height: 100%;
                opacity: 0; cursor: pointer; margin: 0;
            `,
        },
    });

    const container = xnew.nest({ tag: 'div', className: `${css.container} ${className}`, style });

    xnew((unit: xnew.Unit) => {
        xnew.nest({ tag: 'svg', viewBox: '0 0 12 12', className: css.svg });
        xnew('<path d="M2 6 5 9 10 3"/>');
    });

    update(value);

    // hidden native input for interaction
    xnew.nest({ tag: 'input', type: 'checkbox', checked: value, className: css.input, ...others });
    unit.on('input', ({ value }: { value: boolean }) => {
        update(value);
    });

    function update(checked: boolean) {
        container.toggleAttribute('data-checked', checked);
    }
}
