import { isObject, isString, isFunction, error } from './common';
import { XNode } from './xnode';

export function xscope(...args) {

    // parent xnode
    let parent = undefined;
    if (args[0] instanceof XNode || args[0] === null || args[0] === undefined) {
        parent = args.shift();
    }

    // callback function
    if (isFunction(args[0]) === false) {
        error('xscope', 'The argument is invalid.', 'component');
    } else {
        return XNode.scope(parent, ...args);
    }
}
