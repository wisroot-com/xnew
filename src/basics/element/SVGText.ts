//----------------------------------------------------------------------------------------------------
// SVGText — SVG-rendered text auto-fitted to its bounding box
// The svg (and thus the shrink-wrapping container) is resized to the text's bbox, so the
// element's footprint matches the rendered glyphs; style the text via designs.svg, not attributes.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { Container } from './Container';
import { Design } from '../design';

export function SVGText(unit: xnew.Unit,
    { text = '', fontSize = 20, className = '', style = '', designs = {}, ...others }:
    { text?: string, fontSize?: number, className?: string, style?: string, designs?: { svg?: Design }, [key: string]: any } = {}
) {
    // the shell shrink-wraps the bbox-fitted <svg>
    xnew.extend(Container, {
        base: 'box-sizing: border-box; width: fit-content; height: fit-content;',
        className, style,
    });

    const css = xnew.css({
        // sized by resize(); overflow keeps the stroke halo outside the bbox visible;
        // the presentation defaults (text = visible fill) inherit down to the <text>
        svg: {
            layer: 'base',
            body: `
                box-sizing: border-box; display: block;
                overflow: visible;
                stroke: none; stroke-opacity: 1; stroke-width: 1; stroke-linejoin: round; stroke-linecap: round;
                fill: currentColor; fill-opacity: 1;
            `,
        },
    });
    xnew.nest({
        tag: 'svg', className: `${css.svg} ${designs.svg?.className ?? ''}`, style: designs.svg?.style,
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
