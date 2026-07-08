//----------------------------------------------------------------------------------------------------
// Split — divides the surrounding box into panes added one call at a time (one flexbox split per unit)
//
// Screen layouts are composed by nesting Splits instead of absolute-positioning each child against
// the whole screen. Each pane is a child unit, so callers mount into and listen on panes directly.
//
// - Split : component({ direction }) returning { pane }
// - pane(size, component?, props?) : append a pane and return its unit; number → flexible ratio,
//   string → fixed size (e.g. '3rem')
//
// Usage:
//   xnew.extend(xbasics.Split, { direction: 'column' });
//   unit.pane('3rem', Header);
//   unit.pane(1, (pane) => { xnew(Content); });
//   unit.pane('2rem', Footer, { color: 'gray' });
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';

export function Split(unit: xnew.Unit,
    { direction = 'column' }:
    { direction?: 'column' | 'row' } = {}
) {
    xnew.nest(`<div style="position: relative; width: 100%; height: 100%; display: flex; flex-direction: ${direction};">`);

    return {
        pane(size: number | string = 1, component?: xnew.Component, props?: object) {
            const flex = typeof size === 'number' ? `${size} 1 0` : `0 0 ${size}`;
            const tag = `<div style="position: relative; flex: ${flex}; min-width: 0; min-height: 0; overflow: hidden;">`;
            return component !== undefined ? xnew(tag, component, props) : xnew(tag);
        },
    };
}
