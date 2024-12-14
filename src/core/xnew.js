import { isObject, isString, isFunction, error } from './common';
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

    // base element
    let element = undefined;
    if (args[0] instanceof Element || args[0] instanceof Window || args[0] instanceof Document) {
        element = args.shift();
    } else if (isString(args[0]) === true) {
        element = document.querySelector(args.shift());
    } else if (isObject(args[0]) === true) {
        element = args.shift();
    } else if (args[0] === null) {
        element = args.shift();
    } else if (args[0] === undefined) {
        element = args.shift();
        element = null;
    } else {
        element = null;
    }

    if (isObject(element) === false && args.length > 0 && isFunction(args[0]) === false && isString(args[0]) === false) {
        error('xnew', 'The argument is invalid.', 'component');
    } else {
        return new XNode(parent, element, ...args);
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

export function xtimer(callback, delay = 0, loop = false) {
    
    const current = XNode.current;

    xnew(Timer, delay, loop);

    function Timer(xnode, delay, loop) {
        let timeout = delay;
        let offset = 0.0;
        let time = null;
        let id = null;

        if (document.hidden === false) {
           start();
        }

        function execute() {
            XNode.scope.call(current, callback);
            if (loop) {
                xnode.reboot(delay, loop);
            } else {
                xnode.finalize();
            }
        }

        function start() {
            time = Date.now();
            id = setTimeout(execute, timeout - offset)
        }

        function stop() {
            offset = Date.now() - time + offset;
            clearTimeout(id);
            id = null;
        }

        const xdoc = xnew(document);
        xdoc.on('visibilitychange', (event) => {
            document.hidden === false ? start() : stop();
        });

        return {
            finalize() {
                stop();
            },
        }
    }
}