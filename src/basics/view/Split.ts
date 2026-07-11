//----------------------------------------------------------------------------------------------------
// Split — divides the surrounding box into panes added one call at a time (one flexbox split per unit)
// Layouts are composed by nesting Splits instead of absolute-positioning against the whole screen;
// each pane is a child unit, so callers mount into and listen on panes directly.
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
