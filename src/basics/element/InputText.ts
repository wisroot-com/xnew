//----------------------------------------------------------------------------------------------------
// InputText — framed native text field that inherits the surrounding look
//
// Text entry needs the real control visible, so the native <input type="text"> sits transparent
// inside a framed container, matching the structure of the other Input* elements.
//
// - InputText : component({ className, style, designs, ...rest }) — className / style decorate the
//               container; designs: { field? } — a Design ({ className?, style? }) for the field;
//               rest members (value, name, placeholder, …) pass through to the <input>;
//               emits 'input' with { value } (string)
//
// Usage: const text = xnew(xbasics.InputText, { placeholder: 'name' });
//        text.on('input', ({ value }) => ...);
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { Container } from './Container';
import { Design } from '../design';

export function InputText(unit: xnew.Unit,
    { className = '', style = '', designs = {}, ...others }:
    { className?: string, style?: string, designs?: { field?: Design }, [key: string]: any } = {}
) {
    xnew.extend(Container, {
        base: 'box-sizing: border-box; width: 10rem; height: 1.8rem; margin: 0.125em 0;',
        className, style,
    });

    const cls = xnew.css({
        // framed field; transparent + inherit so the native control sits on any surface
        field: {
            layer: 'base',
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

    xnew.nest({ tag: 'input', type: 'text', className: `${cls.field} ${designs.field?.className ?? ''}`, style: designs.field?.style, ...others });
}
