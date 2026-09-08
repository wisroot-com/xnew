//----------------------------------------------------------------------------------------------------
// Accordion — collapses height + opacity to follow a Gate's progress value
// `gate` is the Gate unit to ride — the caller owns it, so several layers can animate off one Gate.
// It is re-exposed as `gate`, and drives through '-transition' emitted on its own unit.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';

export function Accordion(unit: xnew.Unit,
    { gate, className = '', style = '', ...others }:
    { gate: xnew.Unit, className?: string, style?: string, [key: string]: any }
) {
    const css = xnew.css('base', {
        container: `
            overflow: hidden;
            box-sizing: border-box;
        `,
    });

    xnew.nest({ tag: 'div', className: `${css.container} ${className}`, style, ...others });

    apply(gate.value);
    gate.on('-transition', ({ value }: { value: number }) => apply(value));
    function apply(value: number) {
        unit.current.style.height = value < 1.0 ? unit.current.scrollHeight * value + 'px' : 'auto';
        unit.current.style.opacity = value.toString();
    }

    return {
        get gate() {
            return gate;
        },
    };
}
