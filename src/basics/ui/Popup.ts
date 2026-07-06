//----------------------------------------------------------------------------------------------------
// Popup — full-viewport overlay that opens on mount and finalizes when closed
//
// Presentation layer over OpenAndClose (found via xnew.context): fades with the progress value and
// closes on a click outside the content (directly on the overlay).
//
// - Popup : component (no props)
//
// Usage: xnew(xbasics.OpenAndClose, { open: false }); xnew.extend(xbasics.Popup);
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { OpenAndClose } from './OpenAndClose';

export function Popup(unit: xnew.Unit) {
    const system = xnew.context(OpenAndClose);

    system.on('-closed', () => unit.finalize());
    system.open();

    xnew.nest('<div style="position: fixed; inset: 0; z-index: 1000; opacity: 0;">');
    unit.on('click', ({ event }: { event: PointerEvent }) => event.target === unit.element && system.close());

    system.on('-transition', ({ value }: { value: number }) => {
        unit.element.style.opacity = value.toString();
    });
}
