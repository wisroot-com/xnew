//----------------------------------------------------------------------------------------------------
// Pages — sequential page flow (story pages, tutorials, slideshows) inside a scene
//
// Absorbs the recurring hand-written page loop: index bookkeeping, finalize-and-recreate of the
// current page, rapid-tap guard, and end-of-flow notification.
//
// - Pages : component({ pages, loop, cooldown }) returning { next, prev, go, index, length, page }
//   - pages    : array of page components; an entry may be [Component, props] to pass page props
//   - loop     : next/prev wrap around instead of stopping at the ends (default false)
//   - cooldown : ms to ignore further navigation after each move (rapid-tap guard, default 0)
//   - emits '-pagechange' { index, from } on every move, and '-complete' { index } each time
//     next() is called on the last page while loop is false
//
// Usage:
//   const pages = xnew(xbasics.Pages, { pages: [PageA, PageB], cooldown: 300 });
//   pages.on('-complete', () => scene.change(NextScene));
//   unit.on('pointerdown', () => pages.next());
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';

export function Pages(unit: xnew.Unit,
    { pages = [], loop = false, cooldown = 0 }:
    { pages?: (Function | [Function, any])[], loop?: boolean, cooldown?: number } = {}
) {
    let index = 0;
    let busy = false;
    let page: xnew.Unit | null = null;

    function mount(i: number): void {
        const entry = pages[i];
        const [Component, props] = Array.isArray(entry) ? entry : [entry, undefined];
        page = xnew(unit, Component, props);
    }
    if (pages.length > 0) {
        mount(0);
    }

    function arm(): void {
        if (cooldown > 0) {
            busy = true;
            xnew.timeout(() => { busy = false; }, cooldown);
        }
    }
    function navigate(next: number): void {
        if (next !== index && next >= 0 && next < pages.length) {
            arm();
            const from = index;
            index = next;
            page?.finalize();
            mount(index);
            xnew.emit('-pagechange', { index, from });
        }
    }

    return {
        next(): void {
            if (busy === false) {
                if (index + 1 < pages.length) {
                    navigate(index + 1);
                } else if (loop === true) {
                    navigate(0);
                } else if (pages.length > 0) {
                    arm();
                    xnew.emit('-complete', { index });
                }
            }
        },
        prev(): void {
            if (busy === false) {
                if (index - 1 >= 0) {
                    navigate(index - 1);
                } else if (loop === true) {
                    navigate(pages.length - 1);
                }
            }
        },
        go(i: number): void {
            if (busy === false) {
                navigate(i);
            }
        },
        get index() { return index; },
        get length() { return pages.length; },
        get page() { return page; },
    };
}
