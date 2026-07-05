//----------------------------------------------------------------------------------------------------
// Transition — open / close animation primitives
//
// OpenAndClose owns a 0..1 progress value driven by xnew.transition and exposes open / close /
// toggle, broadcasting the value via '-transition' / '-opened' / '-closed' emits. Accordion and
// Popup are presentation layers that pick up that progress value via xnew.context(OpenAndClose).
//
// - OpenAndClose : component returning { toggle, open, close }
// - Accordion    : collapses height + opacity to follow the progress value
// - Popup        : full-viewport overlay that opens on mount and finalizes when closed
//----------------------------------------------------------------------------------------------------

import { xnew } from '../core/xnew';
import { Unit, UnitTimer } from '../core/unit';

export function OpenAndClose(unit: Unit,
    { open = true, duration = 200, easing = 'ease' }:
    { open?: boolean, duration?: number, easing?: string }
) {
    let value = open ? 1.0 : 0.0;
    let sign: number = open ? +1 : -1;
    let timer = xnew.timeout(() => xnew.emit('-transition', { value }));

    // animate `value` toward 1 (dir +1, open) or 0 (dir -1, close), scaling duration by remaining distance
    function animate(dir: number) {
        sign = dir;
        const d = dir > 0 ? 1 - value : value;
        timer?.clear();
        timer = xnew.transition(({ value: x }: { value: number }) => {
            const remaining = x < 1.0 ? (1 - x) * d : 0.0;
            value = dir > 0 ? 1.0 - remaining : remaining;
            xnew.emit('-transition', { value });
        }, duration * d, easing)
        .timeout(() => xnew.emit(dir > 0 ? '-opened' : '-closed'));
    }

    return {
        toggle() {
            animate(sign < 0 ? +1 : -1);
        },
        open() {
            animate(+1);
        },
        close() {
            animate(-1);
        },
    };
}

export function Accordion(unit: Unit) {
    const system = xnew.context(OpenAndClose);

    const outer = xnew.nest('<div style="overflow: hidden;">') as HTMLElement;
    const inner = xnew.nest('<div style="display: flex; flex-direction: column; box-sizing: border-box;">') as HTMLElement;
    
    system.on('-transition', ({ value }: { value: number }) => {
        outer.style.height = value < 1.0 ? inner.offsetHeight * value + 'px' : 'auto';
        outer.style.opacity = value.toString();
    });
}

export function Popup(unit: Unit) {
    const system = xnew.context(OpenAndClose);

    system.on('-closed', () => unit.finalize());
    system.open();
    
    xnew.nest('<div style="position: fixed; inset: 0; z-index: 1000; opacity: 0;">');
    unit.on('click', ({ event }: { event: PointerEvent }) => event.target === unit.element && system.close());

    system.on('-transition', ({ value }: { value: number }) => {
        unit.element.style.opacity = value.toString();
    });
}