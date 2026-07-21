//----------------------------------------------------------------------------------------------------
// InputSwitch — sliding on / off switch backed by a hidden native <input type="checkbox">
// Holds a Gate for the on/off state and exposes it as `gate`; the invisible native input captures
// interaction. unit.element is the container; used standalone it draws the default Knob, else a compose fn.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { Gate } from '../widget/Gate';

export function InputSwitch(unit: xnew.Unit,
    { value = false, gate, className = '', style = '', ...others }:
    { value?: boolean, gate?: { open?: boolean, duration?: number, easing?: string } | xnew.Unit, className?: string, style?: string, [key: string]: any } = {}
) {
    const css = xnew.css('base', {
        container: `
            display: inline-block;
            width: 3em; max-width: -webkit-fill-available; max-width: -moz-available; max-width: stretch; height: 1.5em; margin: 0.125em 0;
            position: relative;
            border: 1px solid currentColor; border-radius: 1em;
            cursor: pointer; user-select: none;
            &[data-checked] { background: color-mix(in srgb, currentColor 20%, transparent); }
        `,
        input: `
            width: 0; height: 0; margin: 0; opacity: 0;
        `,
    });

    xnew.nest({ tag: 'label', className: `${css.container} ${className}`, style });

    xnew({ tag: 'input', type: 'checkbox', checked: value, className: css.input, ...others });

    gate = xnew.isUnit(gate) ? gate : xnew(Gate, gate ?? { open: value, duration: 0 });
    gate.on('-open', () => unit.element.toggleAttribute('data-checked', true));
    gate.on('-closed', () => unit.element.toggleAttribute('data-checked', false));
    unit.element.toggleAttribute('data-checked', gate.state === 'opened' || gate.state === 'opening');

    unit.on('input', ({ value }: { value: boolean }) => value ? gate.open() : gate.close());

    if (xnew.standalone === true) {
        xnew(Knob);
    }

    return {
        get value() {
            return gate.state === 'opened' || gate.state === 'opening';
        },
        get gate() {
            return gate;
        },
    };
}

//----------------------------------------------------------------------------------------------------
// Knob — the sliding indicator; rides to the far side while the container is data-checked
//----------------------------------------------------------------------------------------------------

function Knob() {
    const css = xnew.css('base', {
        container: `
            position: absolute; top: 0.15em; bottom: 0.15em; left: 0.15em;
            aspect-ratio: 1 / 1; border-radius: 50%;
            background: currentColor;
            transition: left 0.15s, transform 0.15s;
            [data-checked] > & { left: calc(100% - 0.15em); transform: translateX(-100%); }
        `,
    });

    xnew.nest({ tag: 'div', className: css.container });
}
