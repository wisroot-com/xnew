//----------------------------------------------------------------------------------------------------
// Chevron — single-stroke chevron arrow icon pointing in a given direction
//
// The path always points right; direction is applied as a rotate on element.style.transform,
// so callers animating the rotation themselves (e.g. an open/close toggle) use the default and
// drive transform directly.
//
// - Chevron : component({ direction, ...rest }) — direction: 'up' | 'down' | 'left' | 'right'
//             (default 'right'); rest members (className, style, stroke, …) pass through to the <svg>
//
// Usage: xnew(xbasics.Chevron, { direction: 'down', style: 'width: 1em; height: 1em;' });
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { SVG } from './SVG';

const angles = { right: 0, down: 90, left: 180, up: 270 };

export function Chevron(unit: xnew.Unit,
    { direction = 'right', ...others }:
    { direction?: 'up' | 'down' | 'left' | 'right', [key: string]: any } = {}
) {
    xnew.extend(SVG, { viewBox: '0 0 12 12', stroke: 'currentColor', ...others });
    xnew('<path d="M4 2 8 6 4 10"/>');
    unit.element.style.transform = `rotate(${angles[direction]}deg)`;
}
