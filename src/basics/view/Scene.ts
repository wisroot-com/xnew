//----------------------------------------------------------------------------------------------------
// Scene — page-side mixin that binds a unit to its ancestor Stage
//
// A Stage scene extends Scene to navigate from inside itself (`unit.change` delegates to the
// nearest ancestor Stage) and to host runtime children that die with the scene (`unit.add`).
// Outside a Stage, `change(Component, props)` still swaps scenes as siblings.
//
// - Scene : component returning { change, add }
//   - change(label, index?)    : same effect as xnew.context(xbasics.Stage).change(label, index);
//                                no-op when there is no ancestor Stage
//   - change(Component, props?) : standalone (Stage-less) navigation — mounts the next component
//                                under unit.parent and finalizes this scene, so swappable scenes
//                                must share a common parent container
//   - add(Component, props)    : mount a child under this scene unit and return it — finalized
//                                together with the scene when it leaves
//
// Usage:
//   const stage = xnew(xbasics.Stage, { scenes: { title: [Title], play: [Play] }, initial: 'title' });
//
//   function Play(unit) {
//       xnew.extend(xbasics.Scene);
//       unit.add(Enemy, { id: 0 });                  // or from a descendant:
//       unit.on('-gameover', () => unit.change('title'));  //   xnew.context(xbasics.Scene).add(...)
//   }
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { Stage } from './Stage';

export function Scene(unit: xnew.Unit) {

    return {
        change(target: string | Function, option?: any): void {
            if (typeof target === 'string') {
                xnew.context(Stage)?.change(target, option);
            } else {
                xnew(unit.parent, target, option);
                unit.finalize();
            }
        },
        add(Component: Function, props?: any): xnew.Unit {
            return xnew(unit, Component, props);
        }
    }
}
