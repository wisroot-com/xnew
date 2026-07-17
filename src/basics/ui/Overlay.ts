//----------------------------------------------------------------------------------------------------
// Overlay — full-viewport layer that covers the page, opens on mount and finalizes when closed
// Owns its Gate (extended onto this unit): forwards duration / easing, fades with the progress value,
// and closes on a click outside the content (directly on the overlay). Exposes the Gate as `gate`.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { Gate } from './Gate';

export function Overlay(unit: xnew.Unit,
    { duration, easing, className = '', style = '', ...others }:
    { duration?: number, easing?: string, className?: string, style?: string, [key: string]: any } = {}
) {
    // starts closed so mounting fades it in; the Gate emits '-transition' / '-closed' on this unit
    const gate = xnew.extend(Gate, { open: false, duration, easing });

    const css = xnew.css({
        container: {
            layer: 'base',
            block: `
                position: fixed; inset: 0; z-index: 1000;
                opacity: 0;
            `,
        },
    });

    unit.on('-closed', () => unit.finalize());
    gate.open();

    xnew.nest({ tag: 'div', className: `${css.container} ${className}`, style, ...others });
    unit.on('click', ({ event }: { event: PointerEvent }) => event.target === unit.element && gate.close());

    unit.on('-transition', ({ value }: { value: number }) => {
        unit.element.style.opacity = value.toString();
    });

    return {
        get gate() {
            return gate;
        },
    };
}
