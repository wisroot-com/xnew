//----------------------------------------------------------------------------------------------------
// SVG — inline <svg> with shared presentation defaults, wrapped in a Container shell
//
// Thin wrapper that nests an <svg> element with sensible defaults for stroke / fill / line caps
// so callers can drop in <path> / <polygon> / <circle> children without re-specifying the same
// presentation attributes on every shape.
//
// - SVG               : component({ className, style, designs, ...rest }) — className / style
//                       decorate the container (the <svg> fills it); designs: { svg? } — a Design
//                       ({ className?, style? }) for the <svg>; rest members (viewBox, stroke, …)
//                       pass through to the <svg> as attributes, overriding the defaults;
//                       returns { get container }
// - SVGStyleInterface : the basic stroke / fill presentation props, shared with the
//                       SVG-drawn components (SVGText / AnalogStick / DPad)
//
// Usage: xnew(xbasics.SVG, { viewBox: '0 0 64 64', stroke: 'currentColor' });
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { Container } from './Container';
import { Design } from '../design';

export interface SVGStyleInterface {
    stroke?: string;
    strokeOpacity?: number;
    strokeWidth?: number;
    strokeLinejoin?: string;
    strokeLinecap?: string;
    fill?: string;
    fillOpacity?: number;
}

export function SVG(unit: xnew.Unit,
    { className = '', style = '', designs = {}, ...others }:
    { className?: string, style?: string, designs?: { svg?: Design }, [key: string]: any } & SVGStyleInterface = {}
) {
    xnew.extend(Container, { className, style });

    const cls = xnew.css({
        // fills the container
        svg: {
            layer: 'base',
            body: `
                box-sizing: border-box; display: block; width: 100%; height: 100%;
            `,
        },
    });
    xnew.nest({
        tag: 'svg', viewBox: '0 0 64 64', className: `${cls.svg} ${designs.svg?.className ?? ''}`, style: designs.svg?.style,
        stroke: 'none', strokeOpacity: 1, strokeWidth: 1, strokeLinejoin: 'round', strokeLinecap: 'round', fill: 'none', fillOpacity: 1,
        ...others,
    });
}
