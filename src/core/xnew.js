import { isObject } from './common';
import { XNode } from './xnode';

export function xnew(...args) {

    // parent xnode
    let parent = undefined;
    if (args[0] instanceof XNode || args[0] === null || args[0] === undefined) {
        parent = args.shift();
    }

    // base element
    let element = undefined;
    if (args[0] instanceof Element || isObject(args[0]) || args[0] === null || args[0] === undefined) {
        element = args.shift();
    }

    // Component function (+args), or innerHTML
    return new XNode(parent, element, ...args);
}
