//----------------------------------------------------------------------------------------------------
// InputText — framed native text field that inherits the surrounding look
//
// Text entry needs the real control visible, so unlike the gauge-style inputs this styles the
// native <input type="text"> itself with the shared frame to match the other Input* elements.
//
// - InputText : component({ className, ...rest }) — rest members (style, value, name, placeholder, …)
//               pass through to the <input>; emits 'input' with { value } (string)
//
// Usage: const text = xnew('<div style="width: 12em; height: 2em;">', xbasics.InputText, { placeholder: 'name' });
//        text.on('input', ({ value }) => ...);
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';

export function InputText(unit: xnew.Unit,
    { className = '', key, ...others }:
    { className?: string, [key: string]: any } = {}
) {
    // transparent + inherit so the native control sits on any surface
    const cls = xnew.css({
        input: {
            layer: 'xbasics',
            body: `
                box-sizing: border-box; width: 100%; height: 100%;
                padding: 0 0.5em; margin: 0;
                background: transparent; color: inherit; font: inherit;
                border: 1px solid currentColor; border-radius: 0.25em;
                outline: none;
                &:focus { background: color-mix(in srgb, currentColor 20%, transparent); }
            `,
        },
    });

    xnew.nest({ tag: 'input', type: 'text', className: `${cls.input} ${className}`, ...others });
}
