//----------------------------------------------------------------------------------------------------
// Button — framed native button with centered label
// Gives a single button the same framed look as Panel's rows (frame + hover tint + press
// feedback) without pulling in the whole panel.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { Container } from './Container';
import { Design } from '../design';

export function Button(unit: xnew.Unit,
    { text = '', className = '', style = '', designs = {}, ...others }:
    { text?: string, className?: string, style?: string, designs?: { button?: Design }, [key: string]: any } = {}
) {
    xnew.extend(Container, {
        // inline-block flows like a native button; max-width: stretch sizes the margin box, so any horizontal margin never overflows the parent
        base: 'box-sizing: border-box; display: inline-block; vertical-align: middle; width: 10em; max-width: -webkit-fill-available; max-width: -moz-available; max-width: stretch; height: 1.8em; margin: 0.125em;',
        className, style,
    });

    const css = xnew.css({
        button: {
            layer: 'base',
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

    xnew.nest({ tag: 'button', type: 'button', className: `${css.button} ${designs.button?.className ?? ''}`, style: designs.button?.style, ...others }, text);
}
