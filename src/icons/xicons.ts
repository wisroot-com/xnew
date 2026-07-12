//----------------------------------------------------------------------------------------------------
// icons/xicons — builds one component per heroicons entry from the icons/data table
// A single factory + data table keeps source/bundle small (no per-icon boilerplate); each member
// is still a plain component: `xnew(xicons.AcademicCap, { mode, className })`.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../core/xnew';
import { Template, IconPaths, IconProps } from './Template';
import { iconData } from './data';

type IconComponent = (unit: xnew.Unit, props?: IconProps) => void;

function makeIcon(paths: IconPaths): IconComponent {
    return function Icon(unit: xnew.Unit, props: IconProps = {}) {
        xnew.extend(Template, { ...props, paths });
    };
}

const icons = {} as Record<keyof typeof iconData, IconComponent>;
for (const name of Object.keys(iconData) as (keyof typeof iconData)[]) {
    icons[name] = makeIcon(iconData[name] as IconPaths);
}

export const xicons = icons;
