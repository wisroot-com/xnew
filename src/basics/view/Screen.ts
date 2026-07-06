//----------------------------------------------------------------------------------------------------
// Screen — fixed-resolution <canvas> fitted to the surrounding box
//
// Builds on Aspect, wrapping a <canvas> so the drawing buffer keeps width × height while CSS
// scales it to the surrounding box.
//
// - Screen : component({ width, height, fit }) returning { canvas }
//
// Usage: const screen = xnew(xbasics.Screen, { width: 800, height: 600 });
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { Aspect } from './Aspect';

export function Screen(unit: xnew.Unit,
    { width = 800, height = 600, fit = 'contain' }:
    { width?: number, height?: number, fit?: 'contain' | 'cover' } = {}
) {
    xnew.extend(Aspect, { aspect: width / height, fit });

    const canvas = xnew(`<canvas width="${width}" height="${height}" style="width: 100%; height: 100%; vertical-align: bottom;">`);

    return {
        get canvas() { return canvas.element; },
    }
}
