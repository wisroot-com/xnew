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
    xnew.nest('<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; container-type: size;">');
    xnew.nest(`<div style="position: relative; aspect-ratio: ${aspect}; container-type: size;">`);

    if (fit === 'contain') {
        unit.element.style.width = `min(100cqw, calc(100cqh * ${aspect}))`;
    } else {
        unit.element.style.flexShrink = '0';
        unit.element.style.width = `max(100cqw, calc(100cqh * ${aspect}))`;
    }
}
