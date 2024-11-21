import { isString } from './common';
import { XNode } from './xnode';

//----------------------------------------------------------------------------------------------------
// xfind
//----------------------------------------------------------------------------------------------------

export function xfind(key) {
    if (isString(key) === false) {
        throw new Error('xfind: The arguments are invalid.');
    } else {
        const set = new Set();
        key.split(' ').filter((key) => XNode.keyMap.has(key)).forEach((key) => {
            XNode.keyMap.get(key).forEach((xnode) => set.add(xnode));
        });
        return [...set];
    }
}
