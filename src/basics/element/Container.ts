//----------------------------------------------------------------------------------------------------
// Container — the outer shell of the basics components (internal use only, not in xbasics)
// className / style always decorate this shell; tag (default 'div') and rest members shape the
// shell element itself (SVG passes tag: 'svg' so the shell IS the <svg>).
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';

export function Container(unit: xnew.Unit,
    { tag = 'div', base = '', className = '', style = '', ...others }:
    { tag?: string, base?: string, className?: string, style?: string, [key: string]: any } = {}
) {
    const css = xnew.css({ container: { layer: 'base', body: base } });

    const container = xnew.nest({ tag, className: `${css.container} ${className}`, style, ...others });

    return { get container() { return container; } };
}
