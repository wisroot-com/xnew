//----------------------------------------------------------------------------------------------------
// Split — divides the surrounding box into panes added one call at a time (one flexbox split per unit)
//
// Screen layouts are composed by nesting Splits instead of absolute-positioning each child against
// the whole screen. Each pane is a child unit, so callers mount into and listen on panes directly.
//
// - Split : component({ direction }) returning { pane }
// - pane({ size, direction? }, component?) : append a pane and return its unit;
//   number size → flexible ratio, string → fixed size (e.g. '3rem'); giving direction makes the
//   pane itself a Split, so sub-panes can be added right away (without it, the pane has no pane())
//
// Usage:
//   xnew.extend(xbasics.Split, { direction: 'column' });
//   unit.pane({ size: '3rem' }, Header);
//   unit.pane({ size: 1, direction: 'row' }, (main) => {
//       main.pane({ size: 1 }, () => { xnew(Content, { color: 'gray' }); });
//   });
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';

export function Split(unit: xnew.Unit,
    { direction = 'column' }:
    { direction?: 'column' | 'row' } = {}
) {
    xnew.nest(`<div style="position: relative; width: 100%; height: 100%; display: flex; flex-direction: ${direction};">`);

    return {
        pane({ size, direction }: { size: number | string, direction?: 'column' | 'row' },
            component?: xnew.Component
        ) {
            const flex = typeof size === 'number' ? `${size} 1 0` : `0 0 ${size}`;
            const tag = `<div style="position: relative; flex: ${flex}; min-width: 0; min-height: 0; overflow: hidden;">`;
            return xnew(tag, () => {
                if (direction !== undefined) {
                    xnew.extend(Split, { direction });
                }
                if (component !== undefined) {
                    xnew.extend(component);
                }
            });
        },
    };
}
