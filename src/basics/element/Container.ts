//----------------------------------------------------------------------------------------------------
// Container — the outer shell of the element/ components (internal use only, not in xbasics)
//
// className / style always decorate this shell; every other prop of an element stays with its
// inner parts.
//
// - Container : component({ base, className, style }) — base: the shell's default size / design
//               as an @layer base declaration block; nests the container <div>;
//               returns { get container }
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';

export function Container(unit: xnew.Unit,
    { base = '', className = '', style = '' }:
    { base?: string, className?: string, style?: string } = {}
) {
    const cls = xnew.css({ container: { layer: 'base', body: base } });

    const container = xnew.nest({ tag: 'div', className: `${cls.container} ${className}`, style });

    return { get container() { return container; } };
}
