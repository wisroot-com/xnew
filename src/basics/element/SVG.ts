//----------------------------------------------------------------------------------------------------
// SVG — inline <svg> with shared presentation defaults, wrapped in a Container shell
//
// Thin wrapper that nests an <svg> element with sensible defaults for stroke / fill / line caps
// so callers can drop in <path> / <polygon> / <circle> children without re-specifying the same
// presentation attributes on every shape.
//
// - SVG : component({ className, style, designs, ...rest }) — className / style decorate the
//         container (the <svg> fills it); designs: { svg? } — a Design ({ className?, style? })
//         for the <svg>; rest members (viewBox, …) pass through to the <svg> as attributes;
//         returns { get container }
//
// Caveat: the presentation defaults are an @layer base css rule (inherited by the shapes), and
// css beats svg attributes — override them via designs.svg (or page css), not rest members.
//
// Usage: xnew(xbasics.SVG, { viewBox: '0 0 64 64', designs: { svg: { style: 'stroke: currentColor;' } } });
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { Container } from './Container';
import { Design } from '../design';

export function SVG(unit: xnew.Unit,
    { className = '', style = '', designs = {}, ...others }:
    { className?: string, style?: string, designs?: { svg?: Design }, [key: string]: any } = {}
) {
    xnew.extend(Container, { className, style });

    const cls = xnew.css({
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
        tag: 'svg', viewBox: '0 0 64 64', className: `${cls.svg} ${designs.svg?.className ?? ''}`, style: designs.svg?.style,
        ...others,
    });
}
