//----------------------------------------------------------------------------------------------------
// Overlay — full-viewport layer that covers the page, finalizes when its Gate reports fully closed
// `gate` is either Gate props (a new child Gate is created) or an existing Gate unit to reuse; exposed
// as `gate`. Opening is left to the caller (call `.gate.open()`); Overlay only fades and closes.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { Gate } from './Gate';

export function Overlay(unit: xnew.Unit,
    { gate = {}, className = '', style = '', ...others }:
    { gate?: { open?: boolean, duration?: number, easing?: string } | xnew.Unit, className?: string, style?: string, [key: string]: any } = {}
) {
    const gateUnit: xnew.Unit = gate instanceof xnew.Unit ? gate : xnew(Gate, gate);

    const css = xnew.css({
        container: {
            layer: 'base',
            body: `
                position: fixed; inset: 0; z-index: 1000;
                opacity: 0;
            `,
        },
    });

    gateUnit.on('-closed', () => unit.finalize());

    xnew.nest({ tag: 'div', className: `${css.container} ${className}`, style, ...others });
    unit.on('click', ({ event }: { event: PointerEvent }) => event.target === unit.element && gateUnit.close());

    gateUnit.on('-transition', ({ value }: { value: number }) => {
        unit.element.style.opacity = value.toString();
    });

    return {
        get gate() {
            return gateUnit;
        },
    };
}
