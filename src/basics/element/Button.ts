//----------------------------------------------------------------------------------------------------
// Button — framed native button with centered label
//
// The same framed look as Panel's rows (frame + hover tint + press feedback) as a standalone
// element, so a single button matches the panel design without pulling in the whole panel.
//
// - Button : component({ text, className, style, designs, ...rest }) — className / style decorate
//            the container; designs: { button? } — a Design ({ className?, style? }) for the
//            native button; rest members (name, …) pass through to the <button>;
//            emits 'click' with { event, position }; returns { get container }
//
// Usage: const button = xnew(xbasics.Button, { text: 'start' });
//        button.on('click', () => ...);
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { Container } from './Container';
import { Design } from '../design';

export function Button(unit: xnew.Unit,
    { text = '', className = '', style = '', designs = {}, ...others }:
    { text?: string, className?: string, style?: string, designs?: { button?: Design }, [key: string]: any } = {}
) {
    xnew.extend(Container, {
        base: 'box-sizing: border-box; width: 10rem; height: 1.8rem; margin: 0.125em 0;',
        className, style,
    });

    const cls = xnew.css({
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

    xnew.nest({ tag: 'button', type: 'button', className: `${cls.button} ${designs.button?.className ?? ''}`, style: designs.button?.style, ...others }, text);
}
