//----------------------------------------------------------------------------------------------------
// Chevron — single-stroke chevron arrow icon pointing in a given direction
// The path always points right; direction rotates the inner <svg> via style.transform, so callers
// animating the rotation themselves use the default and drive the transform directly.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { Container } from './Container';
import { Design } from '../design';

export function Chevron(unit: xnew.Unit,
    { direction = 'right', className = '', style = '', designs = {}, ...others }:
    { direction?: 'up' | 'down' | 'left' | 'right', className?: string, style?: string, designs?: { svg?: Design }, [key: string]: any } = {}
) {
    xnew.extend(Container, {
        base: 'box-sizing: border-box; width: 1em; height: 1em;',
        className, style,
    });
    const css = xnew.css({
        svg: {
            layer: 'base',
            body: `
                box-sizing: border-box; display: block; width: 100%; height: 100%;
                stroke: currentColor; stroke-width: 1; stroke-linejoin: round; stroke-linecap: round;
                fill: none;
            `,
        },
    });
    xnew.nest({ tag: 'svg', viewBox: '0 0 12 12', className: `${css.svg} ${designs.svg?.className ?? ''}`, style: designs.svg?.style, ...others });
    xnew('<path d="M4 2 8 6 4 10"/>');

    const angles = { right: 0, down: 90, left: 180, up: 270 };
    unit.element.style.transform = `rotate(${angles[direction]}deg)`;
}
