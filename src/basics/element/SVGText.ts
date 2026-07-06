//----------------------------------------------------------------------------------------------------
// SVGText — SVG-rendered text auto-fitted to its bounding box
//
// Extends SVG with a <text> child and resizes the viewBox to the text's bbox, so the element's
// footprint matches the rendered glyphs.
//
// - SVGText : component({ text, fontSize, ... })
//
// Usage: xnew(xbasics.SVGText, { text: 'GAME OVER', fontSize: 24, fill: 'currentColor' });
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { Unit } from '../../core/unit';
import { SVG } from './SVG';

interface SVGTextInterface {
    text?: string;
    fontSize?: number;
    anchor?: { x: number, y: number };
    className?: string;
    style?: string;
    stroke?: string;
    strokeOpacity?: number;
    strokeWidth?: number;
    strokeLinejoin?: string;
    strokeLinecap?: string;
    fill?: string;
    fillOpacity?: number;
}


export function SVGText(unit: Unit, {
    text = '',
    fontSize = 20,
    anchor = { x: 0, y: 0 },
    className = '',
    style = '',
    stroke = 'none',
    strokeOpacity = 1,
    strokeWidth = 1,
    strokeLinejoin = 'round',
    strokeLinecap = 'round',
    fill = 'currentColor',
    fillOpacity = 1
}: SVGTextInterface = {}) {
    xnew.extend(SVG, { className, style, stroke, strokeOpacity, strokeWidth, strokeLinejoin, strokeLinecap, fill, fillOpacity });
    const svg = unit.element as SVGSVGElement;

    xnew.nest(`<text x="0" y="0" font-size="${fontSize}" paint-order="stroke fill">`);
    unit.element.textContent = text;

    function resize() {
        const bbox = (unit.element as SVGGraphicsElement).getBBox();
        const padding = 0;
        svg.setAttribute('viewBox', `
            ${bbox.x - padding}
            ${bbox.y - padding}
            ${bbox.width + padding * 2}
            ${bbox.height + padding * 2}
        `);

        svg.style.width = (bbox.width + padding * 2) + 'px';
    }
    resize();
    unit.on('resize', resize);
    svg.style.overflow = 'visible';
}
