import { isObject, isString, isFunction } from './common';
import { XNode } from './xnode';

export function xnew(...args) {

    // parent xnode
    let parent = undefined;
    if (args[0] instanceof XNode || args[0] === null || args[0] === undefined) {
        parent = args.shift();
    }

    // base element
    let element = undefined;
    if (args[0] instanceof Element || args[0] === window || isObject(args[0]) || args[0] === null || args[0] === undefined) {
        element = args.shift();
    }

    if (args.length === 0 || isFunction(args[0]) || (isObject(element) && isString(args[0]))) {
        return new XNode(parent, element, ...args);
    } else {
        console.error('xnew: The arguments are invalid.');
    }
}
