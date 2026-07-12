//----------------------------------------------------------------------------------------------------
// Scene — scene-swap navigator mixin (the unit swaps itself for the next scene)
// `change` mounts the next component under unit.parent and finalizes this unit, so the mounted
// unit itself is the navigation state; an optional `leave()` define is awaited before the swap.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';

export function Scene(unit: xnew.Unit) {
    let leaving = false;

    return {
        change(Component: Function, props?: any): void {
            if (leaving === false) {
                leaving = true;

                const timer = typeof unit.leave === 'function' ? unit.leave() : undefined;
                if (timer && typeof timer.timeout === 'function') {
                    timer.timeout(finalize); // UnitTimer: chain onto the leave transition
                } else {
                    finalize();
                }

                function finalize() {
                    xnew(unit.parent, Component, props);
                    unit.finalize();
                }
            }
        },
        add(Component: Function, props?: any): xnew.Unit {
            return xnew(unit, Component, props);
        }
    }
}
