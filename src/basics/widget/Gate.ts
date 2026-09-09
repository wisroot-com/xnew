//----------------------------------------------------------------------------------------------------
// Gate — open / close animation driver
// Owns a 0..1 progress value driven by xnew.transition; presentation layers (Accordion, Popover)
// extend it onto their own unit and expose it as `gate`, following '-transition' emitted on that unit.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';

export type GateProps = { open?: boolean, duration?: number, easing?: string };

export function Gate(unit: xnew.Unit,
    { open = true, duration = 0, easing = 'ease' }: GateProps = {}
) {
    let value = open ? 1.0 : 0.0;

    if (open === true) {
        xnew.emit('-open');
        xnew.emit('-opened');
    } else {
        xnew.emit('-close');
        xnew.emit('-closed');
    }
    let timer: xnew.Timer = xnew.timeout(() => xnew.emit('-transition', { value }));

    let moving: number = 0;
    function move(direction: number) {
        if (direction === moving) return;
        xnew.emit(direction > 0 ? '-open' : '-close');

        moving = direction;

        const d = direction > 0 ? 1 - value : value;
        timer.clear();
        timer = xnew.transition(({ value: x }: { value: number }) => {
            const remaining = x < 1.0 ? (1 - x) * d : 0.0;
            value = direction > 0 ? 1.0 - remaining : remaining;
            xnew.emit('-transition', { value });
        }, duration * d, easing)
        .timeout(() => {
            moving = 0;
            xnew.emit(direction > 0 ? '-opened' : '-closed');
        });
    }

    return {
        get value() {
            return value;
        },
        get state(): 'opening' | 'closing' | 'opened' | 'closed' {
            if (moving === 0) {
                return value > 0 ? 'opened' : 'closed';
            } else {
                return moving > 0 ? 'opening' : 'closing';
            }
        },
        toggle() {
            move((unit.state === 'opened' || unit.state === 'opening') ? -1 : +1);
        },
        open() {
            move(+1);
        },
        close() {
            move(-1);
        },
    };
}
