//----------------------------------------------------------------------------------------------------
// Accordion — collapses height + opacity to follow a Gate progress value
// Presentation layer over Gate: requires an ancestor (or same-unit extend) Gate,
// found via xnew.context.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { Gate } from './Gate';

export function Accordion(unit: xnew.Unit,
    { className = '', style = '', ...others }:
    { className?: string, style?: string, [key: string]: any } = {}
) {
    const gate = xnew.context(Gate);

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

    apply(gate.value);
    gate.on('-transition', ({ value }: { value: number }) => apply(value));

    // scrollHeight reports the full content height even while clipped, so no inner element is needed
    function apply(value: number) {
        unit.element.style.height = value < 1.0 ? unit.element.scrollHeight * value + 'px' : 'auto';
        unit.element.style.opacity = value.toString();
    }
}
