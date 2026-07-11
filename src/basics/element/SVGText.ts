//----------------------------------------------------------------------------------------------------
// SVGText — SVG-rendered text auto-fitted to its bounding box
//
// Nests a <text> inside an <svg> and resizes the svg (and thus the shrink-wrapping container)
// to the text's bbox, so the element's footprint matches the rendered glyphs.
//
// - SVGText : component({ text, fontSize, className, style, designs, ...rest }) — className /
//             style decorate the container (sized by the text); designs: { svg? } — a Design
//             ({ className?, style? }) for the <svg>; rest members (stroke, …) pass through to
//             the <svg> as attributes, overriding the defaults; returns { get container }
//
// Usage: xnew(xbasics.SVGText, { text: 'GAME OVER', fontSize: 24, fill: 'currentColor' });
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { Container } from './Container';
import { Design } from '../design';
import { SVGStyleInterface } from './SVG';

export function SVGText(unit: xnew.Unit,
    { text = '', fontSize = 20, className = '', style = '', designs = {}, ...others }:
    { text?: string, fontSize?: number, className?: string, style?: string, designs?: { svg?: Design }, [key: string]: any } & SVGStyleInterface = {}
) {
    // the shell shrink-wraps the bbox-fitted <svg>
    xnew.extend(Container, {
        base: 'box-sizing: border-box; width: fit-content; height: fit-content;',
        className, style,
    });

    const cls = xnew.css({
        // sized by resize(); overflow keeps the stroke halo outside the bbox visible
        svg: {
            layer: 'base',
            body: `
                box-sizing: border-box; display: block;
                overflow: visible;
            `,
        },
    });
    // text defaults to visible fill
    xnew.nest({
        tag: 'svg', className: `${cls.svg} ${designs.svg?.className ?? ''}`, style: designs.svg?.style,
        stroke: 'none', strokeOpacity: 1, strokeWidth: 1, strokeLinejoin: 'round', strokeLinecap: 'round', fill: 'currentColor', fillOpacity: 1,
        ...others,
    });
    const svg = unit.element as SVGSVGElement;

    xnew.nest({ tag: 'text', x: 0, y: 0, fontSize, paintOrder: 'stroke fill' });
    unit.element.textContent = text;

    function resize() {
        const bbox = (unit.element as SVGGraphicsElement).getBBox();
        svg.setAttribute('viewBox', `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`);
        svg.style.width = bbox.width + 'px';
        svg.style.height = bbox.height + 'px';
    }
    resize();
    unit.on('resize', resize);
}
