//----------------------------------------------------------------------------------------------------
// Button — framed native button with centered label
//
// The same framed look as Panel's rows (frame + hover tint + press feedback) as a standalone
// element, so a single button matches the panel design without pulling in the whole panel.
//
// - Button : component({ name, className, style }) — emits 'click' with { event, position }
//
// Usage: const button = xnew('<div style="width: 8em; height: 2em;">', xbasics.Button, { name: 'start' });
//        button.on('click', () => ...);
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';
import { sharedCss } from '../styles';

export function Button(unit: xnew.Unit,
    { name = '', className = '', style = '' }:
    { name?: string, className?: string, style?: string } = {}
) {
    const cls = xnew.css(sharedCss);

    // transparent + inherit so the native control sits on any surface; label is set as text, not markup
    xnew.nest(`<button type="button" class="${cls.fill} ${cls.clickable} ${cls.frame} ${cls.hoverTint} ${cls.press} ${className}" style="display: flex; justify-content: center; align-items: center; padding: 0 0.5em; margin: 0; background: transparent; color: inherit; font: inherit; ${style}">`, name);
}
