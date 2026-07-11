//----------------------------------------------------------------------------------------------------
// Container — the outer shell of the basics components (internal use only, not in xbasics)
// className / style always decorate this shell; every other prop stays with the inner parts.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';

export function Container(unit: xnew.Unit,
    { base = '', className = '', style = '' }:
    { base?: string, className?: string, style?: string } = {}
) {
    const css = xnew.css({ container: { layer: 'base', body: base } });

    const container = xnew.nest({ tag: 'div', className: `${css.container} ${className}`, style });

    return { get container() { return container; } };
}
