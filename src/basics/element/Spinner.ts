//----------------------------------------------------------------------------------------------------
// Spinner — rotating ring indicator for loading states
//
// Sample of @keyframes via xnew.css: the { type: 'keyframes', body } entry form scopes the
// animation name exactly like a class key, and `$turn` links the `animation:` reference to it.
//
// - Spinner : component({ className, style })
//
// Usage: xnew('<div style="width: 2em; height: 2em;">', xbasics.Spinner);
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';

export function Spinner(unit: xnew.Unit,
    { className = '', style = '' }:
    { className?: string, style?: string } = {}
) {
    const cls = xnew.css({
        turn: {
            layer: 'base',
            type: 'keyframes',
            body: `
                from { transform: rotate(0turn); }
                to { transform: rotate(1turn); }
            `,
        },
        spinner: {
            layer: 'base',
            body: `
                box-sizing: border-box; width: 100%; height: 100%;
                border: 0.15em solid color-mix(in srgb, currentColor 25%, transparent);
                border-top-color: currentColor;
                border-radius: 50%;
                animation: $turn 0.8s linear infinite;
            `,
        },
    });

    xnew.nest(`<div class="${cls.spinner} ${className}" style="${style}">`);
}
