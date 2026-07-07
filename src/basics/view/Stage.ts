//----------------------------------------------------------------------------------------------------
// Stage — scene container that holds the label → scene map and hosts one active scene
//
// Navigation is owned by the container so scenes stay plain components; scenes are addressed by
// label, and the only transition contract a scene may opt into is a `leave()` define, awaited
// before the scene is finalized. The member surface is deliberately minimal.
//
// - Stage : component({ scenes, initial }) returning { change, next, prev, scene }
//   - scenes   : flat named map — a scene is always [Component, props] (props optional).
//                A value is a single scene or an array of scenes ([[A, props], [B, props], …]).
//   - initial  : label of the scene to mount on creation (default: the first defined label)
//   - change(label)        : go to the labeled scene (array label → its first element)
//   - change(label, index) : array label → its index-th element
//                Unknown labels, out-of-range indices, and the current scene are ignored.
//   - next() / prev()      : move within the current array (label kept, index ± 1); ignored
//                when the current scene is not an array element (index null) or at the ends
//   - scene    : { label, index, unit } of the current scene (index is null unless the scene
//                is an array element); null when the stage is empty
//   - emits '-scenechange' { label, index, fromLabel, fromIndex } on every move
//
// Leave protocol (out-in): if the current scene defines `leave()`, it is called before the swap and
// its return value tells the stage how long to wait before finalizing — a timer (return
// `xnew.transition(...)` directly) or nothing (immediate). The next scene mounts after the old one
// is finalized; entrance effects are the scene's own business (do them in the component body).
//
// Caveats: a value whose first element is a Function is a single scene — inside an array of
// scenes, write every element in [Component, props] form (a bare Component first element would
// make the whole array read as one scene). Navigation during a pending leave transition is
// currently unguarded — avoid calling change/next/prev until it settles.
//
// Usage:
//   const stage = xnew(xbasics.Stage, {
//       scenes: {
//           title: [Title],
//           story: [[PageA, propsA], [PageB, propsB]],   // story, index 0..1 (next/prev walk these)
//           ending: [Ending, props],
//       },
//       initial: 'title',
//   });
//   stage.next();               // within the current array only
//   stage.change('story', 1);
//   stage.change('ending');     // from inside a scene, extend xbasics.Scene and use unit.change(...)
//
//   function PageA(unit) {
//       xnew.nest('<div style="opacity:0;">');
//       xnew.transition(({ value }) => unit.element.style.opacity = `${value}`, 300);
//       return {
//           leave() { return xnew.transition(({ value }) => unit.element.style.opacity = `${1 - value}`, 300); },
//       };
//   }
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';

type StageScene = [Function, any?]; // a scene: [Component, props] (props optional)

// a single scene starts with a Function; an array of scenes starts with an array
function isScene(e: any): boolean {
    return Array.isArray(e) && typeof e[0] === 'function';
}

export function Stage(unit: xnew.Unit,
    { scenes = {}, initial }:
    { scenes?: { [label: string]: StageScene | StageScene[] }, initial?: string } = {}
) {
    // label → [scenes, isArray] (single scenes keep index null)
    const table = new Map<string, [StageScene[], boolean]>();
    for (const [name, node] of Object.entries(scenes)) {
        if (isScene(node)) {
            table.set(name, [[node as StageScene], false]);
        } else if (Array.isArray(node)) {
            table.set(name, [node, true]);
        }
    }

    let label: string | null = null;
    let index: number | null = null;
    let sceneUnit: xnew.Unit | null = null;

    function mount(nextLabel: string, nextIndex: number | null): void {
        [label, index] = [nextLabel, nextIndex];
        const [Component, props] = table.get(nextLabel)![0][nextIndex ?? 0];
        sceneUnit = xnew(unit, Component, props);
    }
    const start = (initial !== undefined && table.has(initial)) ? initial : table.keys().next().value;
    if (start !== undefined) {
        mount(start, table.get(start)![1] ? 0 : null);
    }

    // out-in swap: wait for the current scene's leave() (if any), finalize it, then mount the next.
    // moving to the current scene is ignored.
    function swap(nextLabel: string, nextIndex: number | null): void {
        if (nextLabel !== label || nextIndex !== index) {
            const [fromLabel, fromIndex] = [label, index];
            const finish = () => {
                sceneUnit?.finalize();
                mount(nextLabel, nextIndex);
                xnew.emit('-scenechange', { label, index, fromLabel, fromIndex });
            };

            const timer = (sceneUnit !== null && typeof sceneUnit.leave === 'function') ? sceneUnit.leave() : undefined;
            if (timer && typeof timer.timeout === 'function') {
                timer.timeout(finish); // UnitTimer: chain onto the leave transition
            } else {
                finish();
            }
        }
    }

    return {
        change(target: string, index?: number): void {
            const entry = table.get(target);
            if (entry !== undefined) {
                const [list, isArray] = entry;
                const nextIndex = isArray ? (index ?? 0) : null;
                if (isArray === false || (nextIndex! >= 0 && nextIndex! < list.length)) {
                    swap(target, nextIndex);
                }
            }
        },
        next(): void {
            if (index !== null) {
                unit.change(label!, index + 1);
            }
        },
        prev(): void {
            if (index !== null) {
                unit.change(label!, index - 1);
            }
        },
        get scene() {
            return sceneUnit === null ? null : { label, index, unit: sceneUnit };
        },
    };
}
