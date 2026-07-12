//----------------------------------------------------------------------------------------------------
// SceneList — label → scene table that lets Scene.change address scenes by label
// A pure lookup table; navigation lives in Scene. Invariant: create the SceneList BEFORE the
// first scene in the same scope (or an ancestor) so context resolution can see it.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';

type SceneEntry = [Function, any?]; // one scene: [Component, props] (props optional)

export function SceneList(unit: xnew.Unit,
    { list = {} }: { list?: { [label: string]: SceneEntry } } = {}
) {
    return {
        resolve(label: string): SceneEntry | undefined {
            const entry = list[label];
            return (Array.isArray(entry) && typeof entry[0] === 'function') ? entry : undefined;
        },
    };
}
