import { isObject, isString, isFunction, error } from './common';
import { XNode } from './xnode';

export function xcontext(name, value) {

    const xnode = XNode.current;

    if (isString(name) === false) {
        error('xcontext', 'The argument is invalid.', 'name');
    } else {
        return XNode.context.call(xnode, name, value);
    }
}
