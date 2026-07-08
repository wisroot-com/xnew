//----------------------------------------------------------------------------------------------------
// SceneList — label → scene table that lets Scene.change address scenes by label
//
// A pure lookup table: it holds { label: [Component, props] } and creates nothing itself.
// Navigation lives in Scene; SceneList is optional and only adds label indirection.
//
// - SceneList : component({ list }) returning { resolve }
//   - list           : flat named map — every value is one scene, [Component, props] (props optional)
//   - resolve(label) : the [Component, props] entry, or undefined for unknown labels
//
// Invariant: create the SceneList BEFORE the first scene in the same scope (or an ancestor) —
// context entries chain through the scope, so a preceding sibling is visible to the scenes.
//
// Usage:
//   xnew(xbasics.SceneList, { list: { title: [Title], play: [Play, props] } });
//   xnew(Title);   // the first scene is mounted by the caller
//   // inside a scene (extending xbasics.Scene):  unit.change('play');
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
