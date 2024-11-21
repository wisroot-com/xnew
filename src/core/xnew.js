import { isObject } from './common';
import { XNode } from './xnode';

export function xnew(...args) {

    // a parent xnode
    const parent = (args[0] instanceof XNode || args[0] === null || args[0] === undefined) ? args.shift() : undefined;

    // an existing html element or attributes to create a html element
    const element = (args[0] instanceof Element || isObject(args[0]) || args[0] === null || args[0] === undefined) ? args.shift() : undefined;

    // Component function (+args), or innerHTML
    const content = args;

    return new XNode(parent, element, ...content);
}
