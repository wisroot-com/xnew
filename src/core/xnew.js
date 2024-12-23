import { isObject, isString, isFunction, Timer, error } from './util';
import { XNode } from './xnode';

export function xnew(...args)
{
    // parent xnode
    let parent = undefined;
    if (args[0] instanceof XNode) {
        parent = args.shift();
    } else if (args[0] === null) {
        parent = args.shift();
    } else if (args[0] === undefined) {
        parent = args.shift();
        parent = XNode.current
    } else {
        parent = XNode.current
    }

    // input element
    let element = undefined;
    if (args[0] instanceof Element || args[0] instanceof Window || args[0] instanceof Document) {
        // an existing html element
        element = args.shift();
    } else if (isString(args[0]) === true) {
        // a string for an existing html element
        element = document.querySelector(args.shift());
    } else if (isObject(args[0]) === true) {
        // an attributes for a new html element
        element = args.shift();
    } else if (args[0] === null || args[0] === undefined) {
        element = args.shift();
        element = null;
    } else {
        element = undefined;
    }

    if (args.length > 0 && isObject(element) === false && isString(args[0]) === true) {
        error('xnew', 'The argument is invalid.', 'component');
    } else {
        return new XNode(parent, element, ...args);
    }
}

function self()
{
    return XNode.current;
}
Object.defineProperty(xnew, 'self', { configurable: true, enumerable: true, get: self });

function nest(attributes)
{
    const xnode = XNode.current;

    if (xnode.element instanceof Window || xnode.element instanceof Document) {
        error('xnew.nest', 'No elements are added to window or document.');
    } else if (isObject(attributes) === false) {
        error('xnew.nest', 'The argument is invalid.', 'attributes');
    } else if (xnode._.state !== 'pending') {
        error('xnew.nest', 'This function can not be called after initialized.');
    } else {
        return XNode.nest.call(xnode, attributes);
    }
}
Object.defineProperty(xnew, 'nest', { configurable: true, enumerable: true, value: nest });

function extend(component, ...args)
{
    const xnode = XNode.current;

    if (isFunction(component) === false) {
        error('xnew.extend', 'The argument is invalid.', 'component');
    } else if (xnode._.state !== 'pending') {
        error('xnew.extend', 'This function can not be called after initialized.');
    } else if (xnode._.components.has(component) === true) {
        error('xnew.extend', 'This function has already been added.');
    } else {
        return XNode.extend.call(xnode, component, ...args);
    }
}
Object.defineProperty(xnew, 'extend', { configurable: true, enumerable: true, value: extend });

function context(key, value)
{
    const xnode = XNode.current;

    if (isString(key) === false) {
        error('xnew.context', 'The argument is invalid.', 'key');
    } else {
        return XNode.context.call(xnode, key, value);
    }
}
Object.defineProperty(xnew, 'context', { configurable: true, enumerable: true, value: context });

function find(key)
{
    if (isString(key) === false && isFunction(key) === false) {
        error('xnew.find', 'The argument is invalid.', 'key');
    } else if (isString(key) === true) {
        const set = new Set();
        key.trim().split(/\s+/).forEach((key) => {
            XNode.keys.get(key)?.forEach((xnode) => set.add(xnode));
        });
        return [...set];
    } else if (isFunction(key) === true) {
        const set = new Set();
        XNode.components.get(key)?.forEach((xnode) => set.add(xnode));
        return [...set];
    }
}
Object.defineProperty(xnew, 'find', { configurable: true, enumerable: true, value: find });

function timer(callback, delay = 0, loop = false)
{
    const current = XNode.current;

    const timer = new Timer(() => {
        XNode.scope.call(current, callback);
    }, delay, loop);

    if (document !== undefined) {
        if (document.hidden === false) {
            Timer.start.call(timer);
        }
        const xdoc = xnew(document);
        xdoc.on('visibilitychange', (event) => {
            document.hidden === false ? Timer.start.call(timer) : Timer.stop.call(timer);
        });
    } else {
        Timer.start.call(timer);
    }

    xnew(() => {
        return {
            finalize() {
                timer.clear();
            }
        }
    });
    return timer;
}
Object.defineProperty(xnew, 'timer', { configurable: true, enumerable: true, value: timer });
