//----------------------------------------------------------------------------------------------------
// Overlay — full-viewport backdrop that fades in/out with its Gate and finalizes when it reports closed
// `gate` is Gate props (new child Gate) or an existing Gate unit to reuse, exposed as `gate`; opening is
// the caller's (`.gate.open()`). With `anchor` set, an inner box tracks that element's on-screen rect.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { Gate } from './Gate';

export function Overlay(unit: xnew.Unit,
    { gate = {}, anchor, className = '', style = '', ...others }:
    { gate?: { open?: boolean, duration?: number, easing?: string } | xnew.Unit, anchor?: xnew.Unit | HTMLElement, className?: string, style?: string, [key: string]: any } = {}
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
        // an absolute box on the backdrop, kept aligned to `anchor`'s on-screen rect every update tick
        tether: {
            layer: 'base',
            body: `
                position: absolute; box-sizing: border-box;
            `,
        },
    });

    gateUnit.on('-closed', () => unit.finalize());

    xnew.nest({ tag: 'div', className: `${css.container} ${className}`, style, ...others });
    const container = unit.element as HTMLElement;
    // close on a press outside the nested content: the backdrop, or the anchor-tracking box's own
    // surface (the "hole" over the anchor) — but not the box's children, which hold the actual content
    let box: HTMLElement | null = null;
    unit.on('click', ({ event }: { event: PointerEvent }) => (event.target === container || event.target === box) && gateUnit.close());

    gateUnit.on('-transition', ({ value }: { value: number }) => {
        container.style.opacity = value.toString();
    });

    if (anchor !== undefined) {
        const element = (anchor instanceof xnew.Unit ? anchor.element : anchor) as Element;
        const tetherBox = xnew.nest({ tag: 'div', className: css.tether }) as HTMLElement;
        box = tetherBox;
        sync();
        unit.on('update', sync);

        // the backdrop fills the viewport from its origin, so the anchor's client rect maps straight to the box
        function sync(): void {
            const rect = element.getBoundingClientRect();
            tetherBox.style.left = `${rect.left}px`;
            tetherBox.style.top = `${rect.top}px`;
            tetherBox.style.width = `${rect.width}px`;
            tetherBox.style.height = `${rect.height}px`;
        }
    }

    return {
        get gate() {
            return gateUnit;
        },
    };
}
