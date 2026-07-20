//----------------------------------------------------------------------------------------------------
// InputCheckbox — framed check box backed by a hidden native <input type="checkbox">
// Holds a Gate for the checked state and exposes it as `gate`; the invisible native input captures
// interaction. unit.element is the container (not the input), so a trailing compose fn nests inside it.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { Gate } from '../ui/Gate';

export function InputCheckbox(unit: xnew.Unit,
    { value = false, gate, className = '', style = '', ...others }:
    { value?: boolean, gate?: { open?: boolean, duration?: number, easing?: string } | xnew.Unit, className?: string, style?: string, [key: string]: any } = {}
) {
    const css = xnew.css('base', {
        container: `
                display: inline-block;
                width: 1.5em; height: 1.5em; margin: 0.125em;
                position: relative;
                border: 1px solid currentColor; border-radius: 0.25em;
                cursor: pointer; user-select: none;
                &[data-checked] { background: color-mix(in srgb, currentColor 20%, transparent); }
            `,
        input: `
                width: 0; height: 0; margin: 0; opacity: 0;
            `,
    });

    xnew.nest({ tag: 'label', className: `${css.container} ${className}`, style });

    xnew({ tag: 'input', type: 'checkbox', checked: value, className: css.input, ...others });

    gate = gate instanceof xnew.Unit ? gate : xnew(Gate, gate ?? { open: value, duration: 0 });
    gate.on('-open', () => unit.element.toggleAttribute('data-checked', true));
    gate.on('-closed', () => unit.element.toggleAttribute('data-checked', false));
    unit.element.toggleAttribute('data-checked', gate.state === 'opened' || gate.state === 'opening');

    unit.on('input', ({ value }: { value: boolean }) => value ? gate.open() : gate.close());

    if (xnew.composed === false) {
        xnew(CheckMark);
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
// CheckMark — the default check svg drawn when the caller composed no content; shown while data-checked
//----------------------------------------------------------------------------------------------------

function CheckMark() {
    const css = xnew.css('base', {
        container: `
                box-sizing: border-box; position: absolute; inset: 0; width: 100%; height: 100%;
                stroke: currentColor; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round;
                fill: none;
                opacity: 0;
                [data-checked] > & { opacity: 1; }
            `,
    });

    xnew.nest({ tag: 'svg', viewBox: '0 0 12 12', className: css.container });
    xnew('<path d="M2 6 5 9 10 3"/>');
}
