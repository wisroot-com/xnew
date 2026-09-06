//----------------------------------------------------------------------------------------------------
// Aspect — aspect-ratio container that fits any parent box
// Nests two flex / container-query wrappers so the element keeps the requested aspect ratio
// regardless of which axis is constraining; 'contain' shrinks to fit, 'cover' grows to fill.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';

export function Aspect(unit: xnew.Unit,
    { aspect = 1.0, fit = 'contain' }:
    { aspect?: number, fit?: 'contain' | 'cover' } = {}
) {
    const css = xnew.css('base', {
        // outer flex box that centers the ratio box; container-type: size exposes the parent extent to cqw / cqh
        container: `
                width: 100%; height: 100%;
                display: flex; align-items: center; justify-content: center;
                container-type: size;
            `,
        // ratio box; aspect-ratio and the fitting width are aspect-dependent, so they stay inline
        inner: `
                position: relative;
                container-type: size;
            `,
    });

    xnew.nest({ tag: 'div', className: css.container });
    xnew.nest({ tag: 'div', className: css.inner });

    unit.current.style.aspectRatio = String(aspect);
    if (fit === 'contain') {
        unit.current.style.width = `min(100cqw, calc(100cqh * ${aspect}))`;
    } else {
        unit.current.style.flexShrink = '0';
        unit.current.style.width = `max(100cqw, calc(100cqh * ${aspect}))`;
    }
}
