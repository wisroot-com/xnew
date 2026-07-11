//----------------------------------------------------------------------------------------------------
// Chevron — single-stroke chevron arrow icon pointing in a given direction
//
// The path always points right; direction is applied as a rotate on the inner <svg>'s
// style.transform, so callers animating the rotation themselves (e.g. an open/close toggle)
// use the default and drive the element's transform directly.
//
// - Chevron : component({ direction, className, style, ...rest }) — direction: 'up' | 'down' |
//             'left' | 'right' (default 'right'); className / style decorate the container
//             (default 1em × 1em); rest members (stroke, …) pass through to the <svg>;
//             returns { get container }
//
// Usage: xnew(xbasics.Chevron, { direction: 'down', style: 'width: 1em; height: 1em;' });
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { Container } from './Container';

const angles = { right: 0, down: 90, left: 180, up: 270 };

export function Chevron(unit: xnew.Unit,
    { direction = 'right', className = '', style = '', ...others }:
    { direction?: 'up' | 'down' | 'left' | 'right', className?: string, style?: string, [key: string]: any } = {}
) {
    // sizing shell only; the default size is an overridable @layer base rule
    xnew.extend(Container, {
        base: `
            box-sizing: border-box; width: 1em; height: 1em;
        `,
        className, style,
    });

    // not the SVG component (extending it would collide with this unit's Container), so the
    // presentation defaults are spelled out here
    xnew.nest({
        tag: 'svg', viewBox: '0 0 12 12', style: 'display: block; width: 100%; height: 100%;',
        stroke: 'currentColor', strokeWidth: 1, strokeLinejoin: 'round', strokeLinecap: 'round', fill: 'none',
        ...others,
    });
    xnew('<path d="M4 2 8 6 4 10"/>');
    unit.element.style.transform = `rotate(${angles[direction]}deg)`;
}
