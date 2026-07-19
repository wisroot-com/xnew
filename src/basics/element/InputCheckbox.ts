//----------------------------------------------------------------------------------------------------
// InputCheckbox — framed check box backed by a hidden native <input type="checkbox">
// Holds a Gate for the checked state and exposes it as `gate`; the invisible native input captures
// interaction. A trailing function composes the mark into the container and reacts to `gate`
// (`xnew(InputCheckbox, {}, (unit) => { … unit.gate … xnew(xicons.Check) })`); left empty, a default
// check svg is drawn. unit.element is the container (not the input), so composed content nests inside it.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { Gate } from '../ui/Gate';

export function InputCheckbox(unit: xnew.Unit,
    { value = false, gate, className = '', style = '', ...others }:
    { value?: boolean, gate?: { open?: boolean, duration?: number, easing?: string } | xnew.Unit, className?: string, style?: string, [key: string]: any } = {}
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
        input: {
            layer: 'base',
            body: `
                position: absolute; inset: 0; z-index: 1; width: 100%; height: 100%;
                opacity: 0; cursor: pointer; margin: 0;
            `,
        },
        mark: {
            layer: 'base',
            body: `
                box-sizing: border-box; position: absolute; inset: 0; width: 100%; height: 100%;
                stroke: currentColor; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round;
                fill: none;
                opacity: 0;
                [data-checked] > & { opacity: 1; }
            `,
        },
    });

    // container is the unit's element: after the input nests below as a child unit, composed content
    // (and the fallback mark) still land inside the container, not inside the hidden input
    const container = xnew.nest({ tag: 'div', className: `${css.container} ${className}`, style });

    // hidden native input for interaction; a child unit so the container stays the current element
    const input = xnew({ tag: 'input', type: 'checkbox', checked: value, className: css.input, ...others });

    gate = gate instanceof xnew.Unit ? gate : xnew(Gate, gate ?? { open: value, duration: 0 });
    container.toggleAttribute('data-checked', gate.state === 'opened' || gate.state === 'opening');
    gate.on('-open', () => container.toggleAttribute('data-checked', true));
    gate.on('-closed', () => container.toggleAttribute('data-checked', false));

    // native input events bubble up to the container, where this listener lives
    unit.on('input', ({ value }: { value: boolean }) => {
        if (value === true) {
            gate.open();
        } else {
            gate.close();
        }
    });

    // fall back to a default check mark when the caller composed none
    if (xnew.composed === false) {
        xnew({ tag: 'svg', viewBox: '0 0 12 12', className: css.mark }, () => {
            xnew('<path d="M2 6 5 9 10 3"/>');
        });
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
