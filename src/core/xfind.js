import { isString } from './common';
import { XNode } from './xnode';

export function xfind(key)
{
    if (isString(key) === false) {
        console.error('xfind: The arguments are invalid.');
    } else {
        const set = new Set();
        key.trim().split(/\s+/).forEach((key) => {
            XNode.keys.get(key)?.forEach((xnode) => set.add(xnode));
        });
        return [...set];
    }
}
