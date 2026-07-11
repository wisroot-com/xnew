//----------------------------------------------------------------------------------------------------
// SVG — inline <svg> with shared presentation defaults, wrapped in a Container shell
//
// Thin wrapper that nests an <svg> element with sensible defaults for stroke / fill / line caps
// so callers can drop in <path> / <polygon> / <circle> children without re-specifying the same
// presentation attributes on every shape.
//
// - SVG               : component({ viewBox, className, style, stroke, fill, ..., ...rest })
//                       — className / style decorate the container (the <svg> fills it);
//                       rest members pass through to the <svg> as attributes;
//                       returns { get container }
// - SVGStyleInterface : the basic stroke / fill presentation props, shared with the
//                       SVG-drawn components (SVGText / AnalogStick / DPad)
//
// Usage: xnew(xbasics.SVG, { viewBox: '0 0 64 64', stroke: 'currentColor' });
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { Container } from './Container';

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
    {
        viewBox = '0 0 64 64',
        className = '',
        style = '',
        stroke = 'none',
        strokeOpacity = 1,
        strokeWidth = 1,
        strokeLinejoin = 'round',
        strokeLinecap = 'round',
        fill = 'none',
        fillOpacity = 1,
        ...others
    }:
    { viewBox?: string; className?: string; style?: string; [key: string]: any } & SVGStyleInterface = {}
) {
    xnew.extend(Container, { className, style });

    xnew.nest({
        tag: 'svg', style: 'display: block; width: 100%; height: 100%;',
        viewBox,
        stroke,
        strokeOpacity,
        strokeWidth,
        strokeLinejoin,
        strokeLinecap,
        fill,
        fillOpacity,
        ...others,
    });
}
