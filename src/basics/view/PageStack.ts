//----------------------------------------------------------------------------------------------------
// PageStack — push/pop history navigation (lobby ↔ room, nested menus)
//
// Keeps a [Component, props] history so pop() can return to the previous page without each page
// hard-coding its way back. Pages are recreated from their props, not preserved — consistent with
// xnew's dispose-and-recreate lifecycle.
//
// - PageStack : component({ root }) returning { push, pop, replace, depth, page }
//   - root : optional first page — Component or [Component, props]
//   - push(Component, props)    : finalize the current page, stack the new one
//   - pop()                     : return to the previous page (ignored at the root)
//   - replace(Component, props) : swap the current page without growing the history
//   - emits '-pagechange' { depth } on every move
//
// Usage:
//   const nav = xnew(xbasics.PageStack, { root: [Lobby, { io }] });
//   nav.push(Room, { io, room });
//   nav.pop(); // back to Lobby
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';

export function PageStack(unit: xnew.Unit,
    { root }: { root?: Function | [Function, any] } = {}
) {
    const stack: [Function, any?][] = [];
    let page: xnew.Unit | null = null;

    function mount(): void {
        const [Component, props] = stack[stack.length - 1];
        page = xnew(unit, Component, props);
    }
    if (root !== undefined) {
        stack.push(Array.isArray(root) ? root : [root, undefined]);
        mount();
    }

    return {
        push(Component: Function, props?: any): void {
            page?.finalize();
            stack.push([Component, props]);
            mount();
            xnew.emit('-pagechange', { depth: stack.length });
        },
        pop(): void {
            if (stack.length > 1) {
                page?.finalize();
                stack.pop();
                mount();
                xnew.emit('-pagechange', { depth: stack.length });
            }
        },
        replace(Component: Function, props?: any): void {
            page?.finalize();
            stack[Math.max(0, stack.length - 1)] = [Component, props];
            mount();
            xnew.emit('-pagechange', { depth: stack.length });
        },
        get depth() { return stack.length; },
        get page() { return page; },
    };
}
