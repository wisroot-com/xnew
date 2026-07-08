//----------------------------------------------------------------------------------------------------
// Scene — scene-swap navigator mixin (the unit swaps itself for the next scene)
//
// A scene component extends Scene to move to the next scene from inside itself: `change` mounts
// the next component under unit.parent and finalizes this unit, so the mounted unit itself is the
// navigation state. Labels resolve through an optional SceneList; the only transition contract a
// scene may opt into is a `leave()` define, awaited before the swap.
//
// - Scene : component returning { change, add }
//   - change(Component, props?) : mount the next scene as a sibling (under unit.parent) and
//                                 finalize this one — swappable scenes must share a parent
//   - change(label)             : resolve [Component, props] via xnew.context(xbasics.SceneList)
//                                 and do the same swap; no-op for unknown labels / no SceneList
//   - add(Component, props)     : mount a child under this scene unit and return it — finalized
//                                 together with the scene when it leaves
//
// Leave protocol (out-in): if this scene defines `leave()`, change calls it and waits for its
// return value — a timer (return `xnew.transition(...)` directly) or nothing (immediate) — before
// swapping. Entrance effects are the next scene's own business (do them in the component body).
// While a leave is pending, further change calls on this scene are ignored (per-scene guard).
//
// Usage:
//   xnew(xbasics.SceneList, { list: { title: [Title], play: [Play] } });
//   xnew(Title);
//
//   function Play(unit) {
//       xnew.extend(xbasics.Scene);
//       unit.add(Enemy, { id: 0 });                  // or from a descendant:
//       unit.on('-gameover', () => unit.change('title'));  //   xnew.context(xbasics.Scene).add(...)
//       return {
//           leave() { return xnew.transition(({ value }) => unit.element.style.opacity = `${1 - value}`, 300); },
//       };
//   }
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { SceneList } from './SceneList';

export function Scene(unit: xnew.Unit) {
    let leaving = false;

    return {
        change(target: string | Function, props?: any): void {
            const entry = typeof target === 'string' ? xnew.context(SceneList)?.resolve(target) : [target, props];
            if (leaving === false && entry !== undefined) {
                leaving = true;

                const timer = typeof unit.leave === 'function' ? unit.leave() : undefined;
                if (timer && typeof timer.timeout === 'function') {
                    timer.timeout(finalize); // UnitTimer: chain onto the leave transition
                } else {
                    finalize();
                }
                
                function finalize() {
                    xnew(unit.parent, ...entry);
                    unit.finalize();
                }
            }
        },
        add(Component: Function, props?: any): xnew.Unit {
            return xnew(unit, Component, props);
        }
    }
}
