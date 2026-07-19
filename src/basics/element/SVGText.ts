//----------------------------------------------------------------------------------------------------
// SVGText — SVG-rendered text auto-fitted to its bounding box
// The svg is resized to the text's bbox, so the element's footprint matches the rendered
// glyphs; style the text via className / style (css beats svg presentation attributes).
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';

export function SVGText(unit: xnew.Unit,
    { text = '', fontSize = 20, className = '', style = '', ...others }:
    { text?: string, fontSize?: number, className?: string, style?: string, [key: string]: any } = {}
) {
    const css = xnew.css('base', {
        // sized by resize(); overflow keeps the stroke halo outside the bbox visible;
        // the presentation defaults (text = visible fill) inherit down to the <text>
        svg: `
                stroke: none; stroke-opacity: 1; stroke-width: 1; stroke-linejoin: round; stroke-linecap: round;
                fill: currentColor; fill-opacity: 1;
                overflow: visible;
            `,
    });

    xnew.nest({ tag: 'svg', className: `${css.svg} ${className}`, style, ...others });

    const textUnit = xnew({ tag: 'text', x: 0, y: 0, fontSize, paintOrder: 'stroke fill' }, text);

    function resize() {
        const bbox = (textUnit.element as SVGGraphicsElement).getBBox();
        unit.element.setAttribute('viewBox', `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`);
        unit.element.style.width = bbox.width + 'px';
        unit.element.style.height = bbox.height + 'px';
    }
    resize();
    textUnit.on('resize', resize);
}
