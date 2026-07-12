//----------------------------------------------------------------------------------------------------
// Popup — full-viewport overlay that opens on mount and finalizes when closed
// Presentation layer over Gate (found via xnew.context): fades with the progress value
// and closes on a click outside the content (directly on the overlay).
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { Gate } from './Gate';

export function Popup(unit: xnew.Unit,
    { className = '', style = '', ...others }:
    { className?: string, style?: string, [key: string]: any } = {}
) {
    const gate = xnew.context(Gate);

    const css = xnew.css({
        // full-viewport overlay above page chrome; opacity is progress-driven, so it stays inline
        container: {
            layer: 'base',
            body: `
                position: fixed; inset: 0; z-index: 1000;
                opacity: 0;
            `,
        },
    });

    gate.on('-closed', () => unit.finalize());
    gate.open();

    xnew.nest({ tag: 'div', className: `${css.container} ${className}`, style, ...others });
    unit.on('click', ({ event }: { event: PointerEvent }) => event.target === unit.element && gate.close());

    gate.on('-transition', ({ value }: { value: number }) => {
        unit.element.style.opacity = value.toString();
    });
}
