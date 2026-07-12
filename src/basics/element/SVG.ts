//----------------------------------------------------------------------------------------------------
// SVG — inline <svg> with shared presentation defaults
// The presentation defaults are an @layer base css rule, and css beats svg presentation
// attributes — override them via className / style (or page css), not rest members.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';

export function SVG(unit: xnew.Unit,
    { className = '', style = '', ...others }:
    { className?: string, style?: string, [key: string]: any } = {}
) {
    const css = xnew.css({
        svg: {
            layer: 'base',
            body: `
                stroke: none; stroke-opacity: 1; stroke-width: 1; stroke-linejoin: round; stroke-linecap: round;
                fill: none; fill-opacity: 1;
            `,
        },
    });

    xnew.nest({ tag: 'svg', viewBox: '0 0 64 64', className: `${css.svg} ${className}`, style, ...others });
}
