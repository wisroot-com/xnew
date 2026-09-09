//----------------------------------------------------------------------------------------------------
// Screen — fixed-resolution <canvas> fitted to the surrounding box
// Builds on Aspect: the drawing buffer keeps width × height while CSS scales it to the box. The canvas
// fills that box, so anything put beside it has to be positioned — a flow sibling lands below it.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { Aspect } from './Aspect';

// `nest: false` builds the aspect box and the canvas in a child unit, leaving unit.current on the caller's element: what follows is then sized and placed against that box instead of the canvas box, so it needs a container-type: size (for cq units) and a position: relative (for absolute placement) of its own — the point being that with fit: 'cover' the canvas box runs past what is on screen, while the caller's box is exactly what is on screen.
export function Screen(unit: xnew.Unit,
    { width = 800, height = 600, fit = 'contain', nest = true }:
    { width?: number, height?: number, fit?: 'contain' | 'cover', nest?: boolean } = {}
) {
    const css = xnew.css('base', {
        // vertical-align: bottom drops the inline-canvas baseline gap so the buffer fills the ratio box exactly
        canvas: `
                width: 100%; height: 100%;
                vertical-align: bottom;
            `,
    });

    let canvas: xnew.Unit;
    if (nest === true) {
        xnew.extend(Aspect, { aspect: width / height, fit });
        canvas = xnew({ tag: 'canvas', width, height, className: css.canvas });
    } else {
        canvas = xnew(() => {
            xnew.extend(Aspect, { aspect: width / height, fit });
            xnew.nest({ tag: 'canvas', width, height, className: css.canvas });
        });
    }

    return {
        get canvas() { return canvas.current; },
    }
}
