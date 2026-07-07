//----------------------------------------------------------------------------------------------------
// Stage — swap container that hosts one active page and coordinates page transitions
//
// Navigation is owned by the container so pages stay plain components; pages are addressed by
// label, and the only transition contract a page may opt into is a `leave()` define, awaited
// before the page is finalized. The member surface is deliberately minimal.
//
// - Stage : component({ pages }) returning { change, next, prev, page }
//   - pages    : flat named map — a page is always [Component, props] (props optional).
//                A value is a single page or an array of pages ([[A, props], [B, props], …]).
//                The first defined page mounts on creation.
//   - change(label)        : go to the labeled page (array label → its first element)
//   - change(label, index) : array label → its index-th element
//                Unknown labels, out-of-range indices, and the current page are ignored.
//   - next() / prev()      : move within the current array (label kept, index ± 1); ignored
//                when the current page is not an array element (index null) or at the ends
//   - page     : { label, index, unit } of the current page (index is null unless the page
//                is an array element); null when the stage is empty
//   - emits '-pagechange' { label, index, fromLabel, fromIndex } on every move
//
// Leave protocol (out-in): if the current page defines `leave()`, it is called before the swap and
// its return value tells the stage how long to wait before finalizing — a timer (return
// `xnew.transition(...)` directly) or nothing (immediate). The next page mounts after the old one
// is finalized; entrance effects are the page's own business (do them in the component body).
//
// Caveats: a value whose first element is a Function is a single page — inside an array of
// pages, write every element in [Component, props] form (a bare Component first element would
// make the whole array read as one page). Navigation during a pending leave transition is
// currently unguarded — avoid calling change/next/prev until it settles.
//
// Usage:
//   const stage = xnew(xbasics.Stage, {
//       pages: {
//           intro: [Intro],
//           story: [[PageA, propsA], [PageB, propsB]],   // story, index 0..1 (next/prev walk these)
//           ending: [Ending, props],
//       },
//   });
//   stage.next();               // within the current array only
//   stage.change('story', 1);
//   stage.change('ending');     // e.g. from inside a page: xnew.context(xbasics.Stage).change(...)
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

type StagePage = [Function, any?]; // a page: [Component, props] (props optional)

// a single page starts with a Function; an array of pages starts with an array
function isPage(e: any): boolean {
    return Array.isArray(e) && typeof e[0] === 'function';
}

export function Stage(unit: xnew.Unit,
    { pages = {} }:
    { pages?: { [label: string]: StagePage | StagePage[] } } = {}
) {
    // label → [pages, isArray] (single pages keep index null)
    const table = new Map<string, [StagePage[], boolean]>();
    for (const [name, node] of Object.entries(pages)) {
        if (isPage(node)) {
            table.set(name, [[node as StagePage], false]);
        } else if (Array.isArray(node)) {
            table.set(name, [node, true]);
        }
    }

    let label: string | null = null;
    let index: number | null = null;
    let pageUnit: xnew.Unit | null = null;

    function mount(nextLabel: string, nextIndex: number | null): void {
        [label, index] = [nextLabel, nextIndex];
        const [Component, props] = table.get(nextLabel)![0][nextIndex ?? 0];
        pageUnit = xnew(unit, Component, props);
    }
    const first = table.keys().next().value;
    if (first !== undefined) {
        mount(first, table.get(first)![1] ? 0 : null);
    }

    // out-in swap: wait for the current page's leave() (if any), finalize it, then mount the next.
    // moving to the current page is ignored.
    function swap(nextLabel: string, nextIndex: number | null): void {
        if (nextLabel !== label || nextIndex !== index) {
            const [fromLabel, fromIndex] = [label, index];
            const finish = () => {
                pageUnit?.finalize();
                mount(nextLabel, nextIndex);
                xnew.emit('-pagechange', { label, index, fromLabel, fromIndex });
            };

            const timer = (pageUnit !== null && typeof pageUnit.leave === 'function') ? pageUnit.leave() : undefined;
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
        get page() {
            return pageUnit === null ? null : { label, index, unit: pageUnit };
        },
    };
}
