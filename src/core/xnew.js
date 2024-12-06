import { isObject, isString, isFunction, error } from './common';
import { XNode } from './xnode';

export function xnew(...args)
{
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

    if (isObject(element) === false && args.length > 0 && isFunction(args[0]) === false && isString(args[0]) === false) {
        error('xnew', 'The argument is invalid.', 'component');
    } else {
        return new XNode(parent, element, ...args);
    }
}

export function xnest(attributes)
{
    const xnode = XNode.current;

    if (xnode === null) {
        error('xnest', 'This function can not be called outside a component function.');
    } else if (xnode.element instanceof Window) {
        error('xnest', 'No elements are added to window.');
    } else if (isObject(attributes) === false) {
        error('xnest', 'The argument is invalid.', 'attributes');
    } else if (xnode._.state !== 'pending') {
        error('xnest', 'This function can not be called after initialized.');
    } else {
        XNode.nest.call(xnode, attributes);
        return xnode.element;
    }
}

export function xextend(component, ...args)
{
    const xnode = XNode.current;

    if (xnode === null) {
        error('xextend', 'This function can not be called outside a component function.');
    } else if (isFunction(component) === false) {
        error('xextend', 'The argument is invalid.', 'component');
    } else if (xnode._.state !== 'pending') {
        error('xextend', 'This function can not be called after initialized.');
    } else {
        return XNode.extend.call(xnode, component, ...args);
    }
}

export function xcontext(name, value)
{
    const xnode = XNode.current;

    if (isString(name) === false) {
        error('xcontext', 'The argument is invalid.', 'name');
    } else {
        return XNode.context.call(xnode, name, value);
    }
}

export function xfind(key)
{
    if (isString(key) === false) {
        error('xfind', 'The argument is invalid.', 'key');
    } else {
        const set = new Set();
        key.trim().split(/\s+/).forEach((key) => {
            XNode.keys.get(key)?.forEach((xnode) => set.add(xnode));
        });
        return [...set];
    }
}

export function xscope(...args)
{
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

export function xtimer(callback, delay = 0) {
    
    return xnew((xnode) => {
        let id = null;
        let timeout = delay;
        let offset = 0.0;
        let start = 0.0;
        let time = 0.0;

        return {
            get time() {
                return time;
            },
            start() {
                start = Date.now();
                time = offset;
                id = setTimeout(wcallback, timeout - time)
            },
            update() {
                time = Date.now() - start + offset;
            },
            stop() {
                offset = Date.now() - start + offset;
                clearTimeout(id);
                id = null;
            },
            finalize() {
                if (id !== null) {
                    clearTimeout(id);
                }
            },
        }

        function wcallback() {
            const repeat = XNode.scope.call(xnode.parent, callback);
            if (repeat === true) {
                xnode.stop();
                offset = 0.0;
                xnode.start();
            } else {
                xnode.finalize();
            }
        }
    });
}