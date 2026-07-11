//----------------------------------------------------------------------------------------------------
// InputNumber — framed native number field
// The unstylable native spinner is hidden so the field matches the other Input* elements
// (keyboard arrows still step the value).
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { Container } from './Container';
import { Design } from '../design';

export function InputNumber(unit: xnew.Unit,
    { className = '', style = '', designs = {}, ...others }:
    { className?: string, style?: string, designs?: { field?: Design }, [key: string]: any } = {}
) {
    xnew.extend(Container, {
        base: 'box-sizing: border-box; width: 10em; height: 1.8em; margin: 0.125em 0;',
        className, style,
    });

    const css = xnew.css({
        // framed field; transparent + inherit so the native control sits on any surface,
        // with the unstylable native spinner hidden
        field: {
            layer: 'base',
            body: `
                box-sizing: border-box; width: 100%; height: 100%;
                text-align: center; padding: 0 0.5em; margin: 0;
                background: transparent; color: inherit; font: inherit;
                border: 1px solid currentColor; border-radius: 0.25em;
                outline: none;
                -moz-appearance: textfield; appearance: textfield;
                &::-webkit-inner-spin-button, &::-webkit-outer-spin-button { -webkit-appearance: none; appearance: none; margin: 0; }
                &:focus { background: color-mix(in srgb, currentColor 20%, transparent); }
            `,
        },
    });

    xnew.nest({ tag: 'input', type: 'number', className: `${css.field} ${designs.field?.className ?? ''}`, style: designs.field?.style, ...others });
}
