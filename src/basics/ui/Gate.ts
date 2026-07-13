//----------------------------------------------------------------------------------------------------
// Gate — open / close animation driver
// Owns a 0..1 progress value driven by xnew.transition; presentation layers (Accordion, Popup)
// pick it up via xnew.context(Gate).
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';

export function Gate(unit: xnew.Unit,
    { open = true, duration = 200, easing = 'ease' }:
    { open?: boolean, duration?: number, easing?: string }
) {
    let value = open ? 1.0 : 0.0;
    let sign: number = open ? +1 : -1;
    // deferred initial emit: presentation layers subscribe after this body, so publish the starting value next tick
    let timer = xnew.timeout(() => xnew.emit('-transition', { value }));

    // animate `value` toward 1 (dir +1, open) or 0 (dir -1, close), scaling duration by remaining distance
    function animate(dir: number) {
        sign = dir;
        const d = dir > 0 ? 1 - value : value;
        timer.clear();
        timer = xnew.transition(({ value: x }: { value: number }) => {
            const remaining = x < 1.0 ? (1 - x) * d : 0.0;
            value = dir > 0 ? 1.0 - remaining : remaining;
            xnew.emit('-transition', { value });
        }, duration * d, easing)
        .timeout(() => xnew.emit(dir > 0 ? '-opened' : '-closed'));
    }

    return {
        // current 0..1 progress, so a presentation layer can apply the starting state synchronously
        get value() {
            return value;
        },
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
