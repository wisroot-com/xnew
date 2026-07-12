//----------------------------------------------------------------------------------------------------
// InputSwitch — sliding on / off switch backed by a hidden native <input type="checkbox">
// The invisible native checkbox captures interaction; the on state lives in css rules keyed on
// a data-checked attribute, so designs stay intact.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { Design } from '../design';

export function InputSwitch(unit: xnew.Unit,
    { value = false, className = '', style = '', designs = {}, ...others }:
    { value?: boolean, className?: string, style?: string, designs?: { frame?: Design, knob?: Design }, [key: string]: any } = {}
) {
    const css = xnew.css({
        // layout only; max-width: stretch sizes the margin box, so any horizontal margin never overflows the parent
        container: {
            layer: 'base',
            body: `
                display: inline-block;
                width: 3em; max-width: -webkit-fill-available; max-width: -moz-available; max-width: stretch; height: 1.5em; margin: 0.125em 0;
                position: relative;
                user-select: none;
            `,
        },
        // full-extent overlay carrying the framed look; the on state is on the container
        frame: {
            layer: 'base',
            body: `
                position: absolute; inset: 0;
                border: 1px solid currentColor; border-radius: 1em;
                [data-checked] > & { background: color-mix(in srgb, currentColor 20%, transparent); }
            `,
        },
        knob: {
            layer: 'base',
            body: `
                position: absolute; top: 0.15em; bottom: 0.15em; left: 0.15em;
                aspect-ratio: 1 / 1; border-radius: 50%;
                background: currentColor;
                transition: left 0.15s, transform 0.15s;
                [data-checked] > & { left: calc(100% - 0.15em); transform: translateX(-100%); }
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

    xnew({ tag: 'div', className: `${css.knob} ${designs.knob?.className ?? ''}`, style: designs.knob?.style });

    const update = (checked: boolean) => {
        container.toggleAttribute('data-checked', checked);
    };
    update(value);

    // hidden native input for interaction
    xnew.nest({ tag: 'input', type: 'checkbox', checked: value, className: css.input, ...others });
    unit.on('input', ({ value }: { value: boolean }) => {
        update(value);
    });
}
