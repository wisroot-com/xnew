import { isObject } from './common';
import { XNode } from './xnode';

export function xnew(...args) {

    // a parent xnode
    let parent = undefined;
    if (args[0] instanceof XNode || args[0] === null || args[0] === undefined) {
        parent = args.shift();
    }
    const e = document.createElement('div');
    e.innerText = 'aaa';
    document.body.appendChild(e);
    let element = undefined;
    if (args[0] instanceof Element || isObject(args[0]) || args[0] === null || args[0] === undefined) {
        element = args.shift();
    }

    // Component function (+args), or innerHTML
    const content = args;

    return new XNode(parent, element, ...content);
}
