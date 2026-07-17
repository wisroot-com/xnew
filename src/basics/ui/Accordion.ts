//----------------------------------------------------------------------------------------------------
// Accordion — collapses height + opacity to follow its own Gate's progress value
// Owns the Gate (extended onto this unit): forwards open / duration / easing to it and exposes it as `gate`.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { Gate } from './Gate';

export function Accordion(unit: xnew.Unit,
    { open, duration, easing, className = '', style = '', ...others }:
    { open?: boolean, duration?: number, easing?: string, className?: string, style?: string, [key: string]: any } = {}
) {
    const gate = xnew.extend(Gate, { open, duration, easing });

    const css = xnew.css({
        container: {
            layer: 'base',
            block: `
                overflow: hidden;
                box-sizing: border-box;
            `,
        },
    });

    xnew.nest({ tag: 'div', className: `${css.container} ${className}`, style, ...others });

    apply(gate.value);
    unit.on('-transition', ({ value }: { value: number }) => apply(value));

    // scrollHeight reports the full content height even while clipped, so no inner element is needed
    function apply(value: number) {
        unit.element.style.height = value < 1.0 ? unit.element.scrollHeight * value + 'px' : 'auto';
        unit.element.style.opacity = value.toString();
    }

    return {
        get gate() {
            return gate;
        },
    };
}
