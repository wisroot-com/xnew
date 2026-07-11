//----------------------------------------------------------------------------------------------------
// InputCheckbox — framed check box backed by a hidden native <input type="checkbox">
// The invisible native control captures interaction; the checked look lives in css rules keyed
// on a data-checked attribute, so designs stay intact.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { Container } from './Container';
import { Design } from '../design';

export function InputCheckbox(unit: xnew.Unit,
    { value = false, className = '', style = '', designs = {}, ...others }:
    { value?: boolean, className?: string, style?: string, designs?: { check?: Design }, [key: string]: any } = {}
) {
    xnew.extend(Container, {
        // inline-block flows like a native control; max-width: stretch sizes the margin box, so any horizontal margin never overflows the parent
        base: 'box-sizing: border-box; display: inline-block; vertical-align: middle; width: 1.5em; max-width: -webkit-fill-available; max-width: -moz-available; max-width: stretch; height: 1.5em; margin: 0.125em 0;',
        className, style,
    });

    const css = xnew.css({
        check: {
            layer: 'base',
            body: `
                box-sizing: border-box; width: 100%; height: 100%;
                position: relative;
                display: flex; align-items: center; justify-content: center;
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

    const check = xnew.nest({ tag: 'div', className: `${css.check} ${designs.check?.className ?? ''}`, style: designs.check?.style });

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
        check.toggleAttribute('data-checked', checked);
    }
}
