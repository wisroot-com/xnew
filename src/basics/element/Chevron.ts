//----------------------------------------------------------------------------------------------------
// Chevron — single-stroke chevron arrow icon pointing in a given direction
// The path always points right; direction rotates the <svg> shell via style.transform, so callers
// animating the rotation themselves use the default and drive the transform directly.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { Container } from './Container';

export function Chevron(unit: xnew.Unit,
    { direction = 'right', className = '', style = '', ...others }:
    { direction?: 'up' | 'down' | 'left' | 'right', className?: string, style?: string, [key: string]: any } = {}
) {
    xnew.extend(Container, {
        tag: 'svg', viewBox: '0 0 12 12',
        base: `
            width: 1em; height: 1em;
            stroke: currentColor; stroke-width: 1; stroke-linejoin: round; stroke-linecap: round;
            fill: none;
        `,
        className, style, ...others,
    });
    xnew('<path d="M4 2 8 6 4 10"/>');

    const angles = { right: 0, down: 90, left: 180, up: 270 };
    unit.element.style.transform = `rotate(${angles[direction]}deg)`;
}
