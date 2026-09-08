//----------------------------------------------------------------------------------------------------
// Overlay — full-viewport backdrop that fades in/out with a Gate
// `gate` is the Gate unit to ride — the caller owns it — and is re-exposed as `gate`; `anchor` tracks
// an element's rect. Fully closed the backdrop is click-through, so it can stay mounted.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';

export function Overlay(unit: xnew.Unit,
    { gate, anchor, className = '', style = '', ...others }:
    { gate: xnew.Unit, anchor?: HTMLElement, className?: string, style?: string, [key: string]: any }
) {
    const css = xnew.css('base', {
        container: `
                position: fixed; inset: 0; z-index: 1000;
                opacity: 0; pointer-events: none;
                cursor: default;
            `,
    });

    xnew.nest({ tag: 'div', className: `${css.container} ${className}`, style, ...others });

    gate.on('-transition', ({ value }: { value: number }) => unit.current.style.opacity = value.toString());
    gate.on('-open', () => unit.current.style.pointerEvents = 'auto');
    gate.on('-closed', () => unit.current.style.pointerEvents = 'none');

    if (anchor instanceof HTMLElement) {
        const tether = xnew.nest({ tag: 'div', style: 'position: absolute; box-sizing: border-box' }) as HTMLElement;
        track();
        unit.on('update', track);

        // the backdrop fills the viewport from its origin, so the anchor's client rect maps straight to the box
        function track(): void {
            const rect = (anchor as Element).getBoundingClientRect();
            tether.style.left = `${rect.left}px`;
            tether.style.top = `${rect.top}px`;
            tether.style.width = `${rect.width}px`;
            tether.style.height = `${rect.height}px`;
        }
    }

    return {
        get gate() {
            return gate;
        },
    };
}
