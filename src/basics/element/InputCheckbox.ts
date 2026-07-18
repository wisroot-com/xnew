//----------------------------------------------------------------------------------------------------
// InputCheckbox — framed check box backed by a hidden native <input type="checkbox">
// The invisible native control captures interaction; the checked look lives in css rules keyed
// on a data-checked attribute, so caller attributes stay intact.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';

export function InputCheckbox(unit: xnew.Unit,
    { value = false, className = '', style = '', ...others }:
    { value?: boolean, className?: string, style?: string, [key: string]: any } = {}
) {
    const css = xnew.css({
        // the box itself carries the framed look; the checked tint is keyed on data-checked
        container: {
            layer: 'base',
            body: `
                display: inline-block;
                width: 1.5em; height: 1.5em; margin: 0.125em;
                position: relative;
                border: 1px solid currentColor; border-radius: 0.25em;
                &[data-checked] { background: color-mix(in srgb, currentColor 20%, transparent); }
            `,
        },
        svg: {
            layer: 'base',
            body: `
                box-sizing: border-box; display: block; width: 100%; height: 100%;
                stroke: currentColor; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round;
                fill: none;
                opacity: 0;
                [data-checked] > & { opacity: 1; }
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

    // capture the container: after the input is nested below, unit.element is the input, not this box
    const container = xnew.nest({ tag: 'div', className: `${css.container} ${className}`, style });

    xnew({ tag: 'svg', viewBox: '0 0 12 12', className: css.svg }, (unit: xnew.Unit) => {
        xnew('<path d="M2 6 5 9 10 3"/>');
    });

    container.toggleAttribute('data-checked', value);

    // hidden native input for interaction
    xnew.nest({ tag: 'input', type: 'checkbox', checked: value, className: css.input, ...others });
    unit.on('input', ({ value }: { value: boolean }) => {
        container.toggleAttribute('data-checked', value);
    });
}
