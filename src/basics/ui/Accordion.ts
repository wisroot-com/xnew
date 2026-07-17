//----------------------------------------------------------------------------------------------------
// Accordion — collapses height + opacity to follow a Gate's progress value
// `gate` is either Gate props (a new child Gate is created) or an existing Gate unit to reuse; the
// Gate is exposed as `gate` and drives via '-transition' emitted on its own unit.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { Gate } from './Gate';

export function Accordion(unit: xnew.Unit,
    { gate = {}, className = '', style = '', ...others }:
    { gate?: { open?: boolean, duration?: number, easing?: string } | xnew.Unit, className?: string, style?: string, [key: string]: any } = {}
) {
    const gateUnit: xnew.Unit = gate instanceof xnew.Unit ? gate : xnew(Gate, gate);

    const css = xnew.css({
        container: {
            layer: 'base',
            body: `
                overflow: hidden;
                box-sizing: border-box;
            `,
        },
    });

    xnew.nest({ tag: 'div', className: `${css.container} ${className}`, style, ...others });

    apply(gateUnit.value);
    gateUnit.on('-transition', ({ value }: { value: number }) => apply(value));

    // scrollHeight reports the full content height even while clipped, so no inner element is needed
    function apply(value: number) {
        unit.element.style.height = value < 1.0 ? unit.element.scrollHeight * value + 'px' : 'auto';
        unit.element.style.opacity = value.toString();
    }

    return {
        get gate() {
            return gateUnit;
        },
    };
}
