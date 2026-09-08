//----------------------------------------------------------------------------------------------------
// Scene — scene-swap navigator mixin (the unit swaps itself for the next scene)
// `change` only swaps: it mounts the next component under unit.parent and destroys this unit, so the
// mounted unit itself is the navigation state. Exit transitions are the caller's job — run the
// transition first and call `change` when it ends (xnew.transition(...).timeout(() => unit.change(Next))).
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';

export function Scene(unit: xnew.Unit) {
    return {
        change(Component: Function, props?: any): void {
            xnew(unit.parent, Component, props);
            unit.destroy();
        },
        add(Component: Function, props?: any): xnew.Unit {
            return xnew(unit, Component, props);
        }
    }
}
