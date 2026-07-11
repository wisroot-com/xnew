//----------------------------------------------------------------------------------------------------
// SVGText — SVG-rendered text auto-fitted to its bounding box
//
// Extends SVG with a <text> child and resizes the viewBox to the text's bbox, so the element's
// footprint matches the rendered glyphs.
//
// - SVGText : component({ text, fontSize, className, style, ... }) — plus every SVG presentation prop
//
// Usage: xnew(xbasics.SVGText, { text: 'GAME OVER', fontSize: 24, fill: 'currentColor' });
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { SVG, SVGStyleInterface } from './SVG';

export function SVGText(unit: xnew.Unit,
    { text = '', fontSize = 20, ...others }: { text?: string; fontSize?: number; className?: string; style?: string; } & SVGStyleInterface = {}
) {
    // text defaults to visible fill; every other prop passes through to SVG untouched
    xnew.extend(SVG, { fill: 'currentColor', ...others });
    const svg = unit.element as SVGSVGElement;

    xnew.nest({ tag: 'text', x: 0, y: 0, fontSize, paintOrder: 'stroke fill' });
    unit.element.textContent = text;

    function resize() {
        const bbox = (unit.element as SVGGraphicsElement).getBBox();
        svg.setAttribute('viewBox', `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`);
        svg.style.width = bbox.width + 'px';
    }
    resize();
    unit.on('resize', resize);
    svg.style.overflow = 'visible';
}
