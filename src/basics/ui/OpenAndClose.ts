//----------------------------------------------------------------------------------------------------
// OpenAndClose — open / close animation driver
//
// Owns a 0..1 progress value driven by xnew.transition and exposes open / close / toggle,
// broadcasting the value via '-transition' / '-opened' / '-closed' emits. Presentation layers
// (Accordion, Popup) pick up that progress value via xnew.context(OpenAndClose).
//
// - OpenAndClose : component({ open, duration, easing }) returning { toggle, open, close }
//
// Usage: const oc = xnew.extend(xbasics.OpenAndClose, { open: false }); oc.toggle();
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { Unit } from '../../core/unit';

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
