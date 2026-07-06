//----------------------------------------------------------------------------------------------------
// View — viewport-layout building blocks: aspect-ratio container, fitted <canvas>, scene swap
//
// Aspect nests two flex / container-query wrappers so the component's element keeps the requested
// aspect ratio inside any parent box, regardless of which axis is constraining. `fit: 'contain'`
// shrinks to fit; `fit: 'cover'` grows to fill. Screen builds on Aspect, wrapping a fixed-resolution
// <canvas> so the drawing buffer keeps width × height while CSS scales it to the surrounding box.
// Scene is a sibling-swap navigation primitive for moving between top-level views.
//
// - Aspect : component({ aspect, fit })
// - Screen : component({ width, height, fit }) returning { canvas }
// - Scene  : component returning { change, add }
//----------------------------------------------------------------------------------------------------

import { xnew } from '../core/xnew';
import { Unit } from '../core/unit';

export function Aspect(unit: Unit,
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

export function Screen(unit: Unit,
    { width = 800, height = 600, fit = 'contain' }:
    { width?: number, height?: number, fit?: 'contain' | 'cover' } = {}
) {
    xnew.extend(Aspect, { aspect: width / height, fit });

    const canvas = xnew(`<canvas width="${width}" height="${height}" style="width: 100%; height: 100%; vertical-align: bottom;">`);

    return {
        get canvas() { return canvas.element; },
    }
}

export function Scene(unit: Unit) {

    return {
        change(Component: Function, props?: any) {
            xnew(unit.parent, Component, props);
            unit.finalize();
        },
        add(Component: Function, props?: any) {
            xnew(unit, Component, props);
        }
    }
}

