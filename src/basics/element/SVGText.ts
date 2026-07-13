//----------------------------------------------------------------------------------------------------
// SVGText — decorated SVG text auto-fitted to its bounding box
// Stacks sibling <text> layers (shadow → outlines → fill) sharing one glyph geometry, so
// CSS-impossible looks (multiple outlines, gradient fill, drop shadow) compose; svg fits the fill bbox.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';

type SVGTextGradient = { angle?: number, stops: { offset: number, color: string }[] };
type SVGTextFill = string | { gradient: SVGTextGradient };
type SVGTextOutline = { color: string, width: number };
type SVGTextShadow = { dx: number, dy: number, color: string };

const namespace = 'http://www.w3.org/2000/svg';

// page-unique id source for the gradient def referenced by url(#...)
let instanceCount = 0;

export function SVGText(unit: xnew.Unit,
    { text = '', fontSize = 20, fill, outline, shadow, className = '', style = '', ...others }:
    {
        text?: string, fontSize?: number,
        fill?: SVGTextFill, outline?: SVGTextOutline | SVGTextOutline[], shadow?: SVGTextShadow,
        className?: string, style?: string, [key: string]: any,
    } = {}
) {
    const css = xnew.css({
        // sized by resize(); overflow keeps stroke halos / shadow outside the bbox visible;
        // the presentation defaults (text = visible fill) inherit down to every <text> layer
        svg: {
            layer: 'base',
            body: `
                stroke: none; stroke-opacity: 1; stroke-width: 1; stroke-linejoin: round; stroke-linecap: round;
                fill: currentColor; fill-opacity: 1;
                overflow: visible;
            `,
        },
    });

    xnew.nest({ tag: 'svg', className: `${css.svg} ${className}`, style, ...others });

    // a gradient fill is a scoped <linearGradient> def the fill text points at via url(#id)
    let fillPaint = typeof fill === 'string' ? fill : '';
    if (fill !== undefined && typeof fill !== 'string') {
        const id = `xnewSVGText${++instanceCount}Fill`;
        const radian = (fill.gradient.angle ?? 90) * Math.PI / 180;
        const gradient = document.createElementNS(namespace, 'linearGradient');
        gradient.setAttribute('id', id);
        gradient.setAttribute('x1', String(0.5 - Math.cos(radian) / 2));
        gradient.setAttribute('y1', String(0.5 - Math.sin(radian) / 2));
        gradient.setAttribute('x2', String(0.5 + Math.cos(radian) / 2));
        gradient.setAttribute('y2', String(0.5 + Math.sin(radian) / 2));
        fill.gradient.stops.forEach((stop) => {
            const child = document.createElementNS(namespace, 'stop');
            child.setAttribute('offset', `${stop.offset * 100}%`);
            child.setAttribute('stop-color', stop.color);
            gradient.appendChild(child);
        });
        const defs = document.createElementNS(namespace, 'defs');
        defs.appendChild(gradient);
        unit.element.appendChild(defs);
        fillPaint = `url(#${id})`;
    }

    // shadow layer sits at the very back, offset from the glyph
    if (shadow !== undefined) {
        const element = xnew({ tag: 'text', x: shadow.dx, y: shadow.dy, fontSize, paintOrder: 'stroke fill' }, text).element as SVGTextElement;
        element.style.fill = shadow.color;
    }

    // outline layers, widest first (furthest back) so narrower outlines stay visible on top
    const outlines = (outline === undefined ? [] : Array.isArray(outline) ? outline : [outline]).slice().sort((a, b) => b.width - a.width);
    outlines.forEach((entry) => {
        const element = xnew({ tag: 'text', x: 0, y: 0, fontSize, paintOrder: 'stroke fill' }, text).element as SVGTextElement;
        element.style.fill = entry.color;
        element.style.stroke = entry.color;
        element.style.strokeWidth = String(entry.width);
    });

    // fill text is the front layer and the measured element (its bbox drives resize)
    const inner = xnew({ tag: 'text', x: 0, y: 0, fontSize, paintOrder: 'stroke fill' }, text);
    if (fillPaint !== '') {
        (inner.element as SVGTextElement).style.fill = fillPaint;
    }

    function resize() {
        const bbox = (inner.element as SVGGraphicsElement).getBBox();
        unit.element.setAttribute('viewBox', `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`);
        unit.element.style.width = bbox.width + 'px';
        unit.element.style.height = bbox.height + 'px';
    }
    resize();
    inner.on('resize', resize);
}
