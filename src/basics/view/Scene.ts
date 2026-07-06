//----------------------------------------------------------------------------------------------------
// Scene — sibling-swap navigation primitive for moving between top-level views
//
// `change` mounts the next component under the current unit's parent, then finalizes itself, so
// swappable scenes must share a common parent container.
//
// - Scene : component returning { change, add }
//
// Usage: const scene = xnew(xbasics.Scene); scene.change(TitleScene);
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { Unit } from '../../core/unit';

export function Scene(unit: Unit) {

    return {
        change(Component: Function, props?: any) {
            xnew(unit.parent, Component, props);
            unit.finalize();
        },
        add(Component: Function, props?: any) {
            xnew(unit, Component, props);
        }
    }
}
