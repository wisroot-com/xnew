//----------------------------------------------------------------------------------------------------
// Overlay — full-viewport backdrop that fades in/out with its Gate
// `gate` is Gate props (new child Gate) or an existing Gate unit to reuse, exposed as `gate`; opening,
// closing, and reacting to `-closed` (e.g. finalizing) are the caller's. `anchor` tracks an element's rect.
// While the gate is fully closed the backdrop is click-through, so it can stay mounted and just toggle.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { Gate } from './Gate';

export function Overlay(unit: xnew.Unit,
    { gate = {}, anchor, className = '', style = '', ...others }:
    { gate?: { open?: boolean, duration?: number, easing?: string } | xnew.Unit, anchor?: xnew.Unit | HTMLElement, className?: string, style?: string, [key: string]: any } = {}
) {
    gate = gate instanceof xnew.Unit ? gate : xnew(Gate, gate);

    const css = xnew.css({
        container: {
            layer: 'base',
            body: `
                position: fixed; inset: 0; z-index: 1000;
                opacity: 0; pointer-events: none;
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

    xnew.nest({ tag: 'div', className: `${css.container} ${className}`, style, ...others });
    const container = unit.element as HTMLElement;
    // close on a press outside the nested content: the backdrop, or the anchor-tracking box's own
    // surface (the "hole" over the anchor) — but not the box's children, which hold the actual content
    let box: HTMLElement | null = null;
    unit.on('click', ({ event }: { event: PointerEvent }) => (event.target === container || event.target === box) && gate.close());

    gate.on('-transition', ({ value }: { value: number }) => {
        container.style.opacity = value.toString();
        // let the page through the backdrop while fully closed, so a permanently-mounted Overlay stays inert
        container.style.pointerEvents = value > 0 ? 'auto' : 'none';
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
            return gate;
        },
    };
}
