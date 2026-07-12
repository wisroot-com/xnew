//----------------------------------------------------------------------------------------------------
// InputCheckbox — framed check box backed by a hidden native <input type="checkbox">
// The invisible native control captures interaction; the checked look lives in css rules keyed
// on a data-checked attribute, so designs stay intact.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { Design } from '../design';

export function InputCheckbox(unit: xnew.Unit,
    { value = false, className = '', style = '', designs = {}, ...others }:
    { value?: boolean, className?: string, style?: string, designs?: { frame?: Design }, [key: string]: any } = {}
) {
    const css = xnew.css({
        // layout only; max-width: stretch sizes the margin box, so any horizontal margin never overflows the parent
        container: {
            layer: 'base',
            body: `
                display: inline-block;
                width: 1.5em; max-width: -webkit-fill-available; max-width: -moz-available; max-width: stretch; height: 1.5em; margin: 0.125em 0;
                position: relative;
            `,
        },
        // full-extent overlay carrying the framed look; the checked state is on the container
        frame: {
            layer: 'base',
            body: `
                position: absolute; inset: 0;
                border: 1px solid currentColor; border-radius: 0.25em;
                [data-checked] > & { background: color-mix(in srgb, currentColor 20%, transparent); }
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

    const container = xnew.nest({ tag: 'div', className: `${css.container} ${className}`, style });

    xnew({ tag: 'div', className: `${css.frame} ${designs.frame?.className ?? ''}`, style: designs.frame?.style });

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
