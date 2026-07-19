//----------------------------------------------------------------------------------------------------
// Template — shared icon shell: nests the <svg> with per-mode currentColor css and draws the paths
// Each icon supplies only its heroicons path data (from icons/data); the xicons factory wires it up.
// color follows currentColor and size defaults to 1em, both overridable via className / style.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../core/xnew';

// a plain string is a nonzero-fill path; a `[d]` tuple draws with fill-rule / clip-rule "evenodd".
export type IconPath = string | [string];
export type IconPaths = { o: IconPath[], s: IconPath[] };
export type IconProps = { mode?: 'outline' | 'solid', className?: string, style?: string, [key: string]: any };

export function Template(unit: xnew.Unit,
    { mode = 'outline', className = '', style = '', paths, ...others }:
    IconProps & { paths: IconPaths }
) {
    const css = xnew.css('base', {
        outline: `
                width: 1em; height: 1em;
                stroke: currentColor; stroke-width: 1.5; stroke-linejoin: round; stroke-linecap: round;
                fill: none;
            `,
        solid: `
                width: 1em; height: 1em;
                stroke: none;
                fill: currentColor;
            `,
    });

    xnew.nest({ tag: 'svg', viewBox: '0 0 24 24', className: `${css[mode]} ${className}`, style, ...others });

    for (const path of paths[mode === 'solid' ? 's' : 'o']) {
        if (typeof path === 'string') {
            xnew({ tag: 'path', d: path });
        } else {
            xnew({ tag: 'path', d: path[0], fillRule: 'evenodd', clipRule: 'evenodd' });
        }
    }
}
