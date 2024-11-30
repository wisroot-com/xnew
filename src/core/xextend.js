import { isObject, isString, isFunction, error } from './common';
import { XNode } from './xnode';

export function xextend(component, ...args) {

    const xnode = XNode.current;

    if (isFunction(component) === false) {
        error('xextend', 'The argument is invalid.', 'component');
    } else if (xnode._.state !== 'pending') {
        error('xextend', 'This function can not be called after initialized.');
    } else {
        return XNode.extend.call(xnode, component, ...args);
    }
}
