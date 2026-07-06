//----------------------------------------------------------------------------------------------------
// SVG — inline <svg> container with shared presentation defaults
//
// Thin wrapper that nests an <svg> element with sensible defaults for stroke / fill / line caps
// so callers can drop in <path> / <polygon> / <circle> children without re-specifying the same
// presentation attributes on every shape.
//
// - SVG : component({ viewBox, stroke, fill, ... }) — generic SVG root
//
// Usage: xnew(xbasics.SVG, { viewBox: '0 0 64 64', stroke: 'currentColor' });
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';

interface SVGInterface {
    viewBox?: string;
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
        fillOpacity = 1
    }:
    SVGInterface = {}
) {
    xnew.nest(`<svg
        viewBox="${viewBox}"
        class="${className}"
        style="${style}"
        stroke="${stroke}"
        stroke-opacity="${strokeOpacity}"
        stroke-width="${strokeWidth}"
        stroke-linejoin="${strokeLinejoin}"
        stroke-linecap="${strokeLinecap}"
        fill="${fill}"
        fill-opacity="${fillOpacity}"
    ">`);
}
