//----------------------------------------------------------------------------------------------------
// GraphicText — decoratable (fill + stroke halo) text drawn as SVG, auto-fitted to its bounding box
// display: inline-block by default, so it flows inline; the svg is resized to the text's bbox.
// className / style land on the svg; rest props (fontSize, fontFamily, …) land on the inner <text>.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';

export function GraphicText(unit: xnew.Unit,
    { text = '', className = '', style = '', ...others }:
    { text?: string, className?: string, style?: string, [key: string]: any } = {}
) {
    const css = xnew.css('base', {
        container: `
                display: inline-block;
                stroke: none; stroke-opacity: 1; stroke-width: 1; stroke-linejoin: round; stroke-linecap: round;
                fill: currentColor; fill-opacity: 1;
                overflow: visible;
            `,
    });

    xnew.nest({ tag: 'svg', className: `${css.container} ${className}`, style });

    const textUnit = xnew({ tag: 'text', x: 0, y: 0, paintOrder: 'stroke fill', ...others }, text);

    function resize() {
        const bbox = (textUnit.element as SVGGraphicsElement).getBBox();
        unit.element.setAttribute('viewBox', `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`);
        unit.element.style.width = bbox.width + 'px';
        unit.element.style.height = bbox.height + 'px';
    }
    resize();
    textUnit.on('resize', resize);
}
