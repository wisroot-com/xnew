import { isString } from './common';
import { XNode } from './xnode';

export function xfind(key) {
    if (isString(key) === false) {
        console.error('xfind: The arguments are invalid.');
    } else {
        const set = new Set();
        key.split(' ').filter((key) => XNode.keyMap.has(key)).forEach((key) => {
            XNode.keyMap.get(key).forEach((xnode) => set.add(xnode));
        });
        return [...set];
    }
}
