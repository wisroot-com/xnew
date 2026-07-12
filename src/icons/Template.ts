//----------------------------------------------------------------------------------------------------
// Template — shared icon shell: nests the <svg> with per-mode currentColor css and draws the paths
// Each icon component supplies only its heroicons path data: xnew.extend(Template, { paths, ...props });
// color follows currentColor and size defaults to 1em, both overridable via className / style.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../core/xnew';

export type IconProps = { mode?: 'outline' | 'solid', className?: string, style?: string, [key: string]: any };

export function Template(unit: xnew.Unit,
    { mode = 'outline', className = '', style = '', paths, ...others }:
    IconProps & { paths: { outline: string[], solid: string[] } }
) {
    const css = xnew.css({
        outline: {
            layer: 'base',
            body: `
                width: 1em; height: 1em;
                stroke: currentColor; stroke-width: 1.5; stroke-linejoin: round; stroke-linecap: round;
                fill: none;
            `,
        },
        solid: {
            layer: 'base',
            body: `
                width: 1em; height: 1em;
                stroke: none;
                fill: currentColor;
            `,
        },
    });

    xnew.nest({ tag: 'svg', viewBox: '0 0 24 24', className: `${css[mode]} ${className}`, style, ...others });

    for (const d of paths[mode]) {
        xnew({ tag: 'path', d });
    }
}
