//----------------------------------------------------------------------------------------------------
// icons/xicons — builds one component per heroicons entry from the icons/data table
// A single svg-shell factory + data table keeps source/bundle small (no per-icon boilerplate); each
// member is still a plain component: `xnew(xicons.AcademicCap, { mode, className })`.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../core/xnew';
import { iconData } from './data';

// a plain string is a nonzero-fill path; a `[d]` tuple draws with fill-rule / clip-rule "evenodd".
export type IconPath = string | [string];
export type IconPaths = { o: IconPath[], s: IconPath[] };
export type IconProps = { mode?: 'outline' | 'solid', className?: string, style?: string, [key: string]: any };

type IconComponent = (unit: xnew.Unit, props?: IconProps) => void;

// color follows currentColor and size defaults to 1em, both overridable via className / style.
function makeIcon(paths: IconPaths): IconComponent {
    return function Icon(unit: xnew.Unit,
        { mode = 'outline', className = '', style = '', ...others }: IconProps = {}
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
    };
}

const icons = {} as Record<keyof typeof iconData, IconComponent>;
for (const name of Object.keys(iconData) as (keyof typeof iconData)[]) {
    icons[name] = makeIcon(iconData[name] as IconPaths);
}

export const xicons = icons;
