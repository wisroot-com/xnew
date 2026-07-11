//----------------------------------------------------------------------------------------------------
// SVG — inline <svg> with shared presentation defaults, wrapped in a Container shell
// The presentation defaults are an @layer base css rule, and css beats svg presentation
// attributes — override them via designs.svg (or page css), not rest members.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { Container } from './Container';
import { Design } from '../design';

export function SVG(unit: xnew.Unit,
    { className = '', style = '', designs = {}, ...others }:
    { className?: string, style?: string, designs?: { svg?: Design }, [key: string]: any } = {}
) {
    xnew.extend(Container, { className, style });

    const css = xnew.css({
        // fills the container; the presentation defaults inherit down to the shapes
        svg: {
            layer: 'base',
            body: `
                box-sizing: border-box; display: block; width: 100%; height: 100%;
                stroke: none; stroke-opacity: 1; stroke-width: 1; stroke-linejoin: round; stroke-linecap: round;
                fill: none; fill-opacity: 1;
            `,
        },
    });
    xnew.nest({
        tag: 'svg', viewBox: '0 0 64 64', className: `${css.svg} ${designs.svg?.className ?? ''}`, style: designs.svg?.style,
        ...others,
    });
}
