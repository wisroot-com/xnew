//----------------------------------------------------------------------------------------------------
// Button — framed native button with centered label
//
// The same framed look as Panel's rows (frame + hover tint + press feedback) as a standalone
// element, so a single button matches the panel design without pulling in the whole panel.
//
// - Button : component({ textContent, className, ...rest }) — rest members (style, name, …) pass
//            through to the <button>; emits 'click' with { event, position }
//
// Usage: const button = xnew('<div style="width: 8em; height: 2em;">', xbasics.Button, { textContent: 'start' });
//        button.on('click', () => ...);
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';

export function Button(unit: xnew.Unit,
    { textContent = '', className = '', ...others }:
    { textContent?: string, className?: string, [key: string]: any } = {}
) {
    // transparent + inherit so the native control sits on any surface
    const cls = xnew.css({
        button: {
            layer: 'xbasics',
            body: `
                box-sizing: border-box; width: 100%; height: 100%;
                display: flex; justify-content: center; align-items: center;
                padding: 0 0.5em; margin: 0;
                background: transparent; color: inherit; font: inherit;
                border: 1px solid currentColor; border-radius: 0.25em;
                cursor: pointer; user-select: none;
                &:hover { background: color-mix(in srgb, currentColor 20%, transparent); }
                &:active { filter: brightness(0.5); }
            `,
        },
    });

    xnew.nest({ tag: 'button', type: 'button', className: `${cls.button} ${className}`, ...others }, textContent);
}
