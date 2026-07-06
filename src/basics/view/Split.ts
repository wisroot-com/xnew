//----------------------------------------------------------------------------------------------------
// Split — divides the surrounding box into ratio-sized panes (one flexbox split per unit)
//
// Screen layouts are composed by nesting Splits instead of absolute-positioning each child against
// the whole screen. Each pane is a child unit, so callers mount into and listen on panes directly.
//
// - Split : component({ direction, ratio, className }) returning { panes }
//
// Usage:
//   const { panes: [upper, footer] } = xnew(xbasics.Split, { direction: 'column', ratio: [80, 20] });
//   const { panes: [left, right] } = xnew(upper, xbasics.Split, { direction: 'row', ratio: [50, 50] });
//   xnew(left, Content);
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';

export function Split(unit: xnew.Unit,
    { direction = 'column', ratio = [1, 1], className = '' }:
    { direction?: 'column' | 'row', ratio?: (number | string)[], className?: string } = {}
) {
    xnew.nest(`<div class="${className}" style="position: relative; width: 100%; height: 100%; display: flex; flex-direction: ${direction};">`);

    const panes = ratio.map((value) => {
        // number → flexible ratio, string → fixed size (e.g. '13cqh')
        const flex = typeof value === 'number' ? `${value} 1 0` : `0 0 ${value}`;
        return xnew(`<div style="position: relative; flex: ${flex}; min-width: 0; min-height: 0; overflow: hidden;">`);
    });

    return {
        get panes() { return panes; },
    };
}
