//----------------------------------------------------------------------------------------------------
// SVG — inline <svg> with shared presentation defaults; the Container shell IS the <svg>
// The presentation defaults are an @layer base css rule, and css beats svg presentation
// attributes — override them via className / style (or page css), not rest members.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { Container } from './Container';

export function SVG(unit: xnew.Unit,
    { className = '', style = '', ...others }:
    { className?: string, style?: string, [key: string]: any } = {}
) {
    xnew.extend(Container, {
        tag: 'svg', viewBox: '0 0 64 64',
        base: `
            stroke: none; stroke-opacity: 1; stroke-width: 1; stroke-linejoin: round; stroke-linecap: round;
            fill: none; fill-opacity: 1;
        `,
        className, style, ...others,
    });
}
