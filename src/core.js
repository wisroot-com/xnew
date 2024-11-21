import { isString, isNumber, isObject, isFunction, ERRORS } from './common';
import { XNode, xwrap } from './xnode';
export { XNode } from './xnode';

//----------------------------------------------------------------------------------------------------
// xnew
//----------------------------------------------------------------------------------------------------

export function xnew(...args) {

    // a parent xnode
    const parent = (args[0] instanceof XNode || args[0] === null || args[0] === undefined) ? args.shift() : undefined;

    // an existing html element or attributes to create a html element
    const element = (args[0] instanceof Element || isObject(args[0]) || args[0] === null || args[0] === undefined) ? args.shift() : undefined;

    // Component function (+args), or innerHTML
    const content = args;

    return new XNode(parent, element, ...content);
}

//----------------------------------------------------------------------------------------------------
// xfind
//----------------------------------------------------------------------------------------------------

export function xfind(key) {
    if (isString(key) === false) {
        console.error('xfind: ' + ERRORS.ARGUMENT);
    } else {
        const set = new Set();
        key.split(' ').filter((key) => XNode.keyMap.has(key)).forEach((key) => {
            XNode.keyMap.get(key).forEach((xnode) => set.add(xnode));
        });
        return [...set];
    }
}

//----------------------------------------------------------------------------------------------------
// xtimer
//----------------------------------------------------------------------------------------------------

export function xtimer(callback, delay, repeat = false) {
    
    return xnew((xnode) => {
        let id = null;
        let counter = 0;
        
        setTimeout(func, delay);

        return {
            finalize() {
                if (id !== null) {
                    clearTimeout(id);
                    id = null;
                }
            },
        }

        function func() {
            xwrap(xnode.parent, callback);
            counter++;
            if (repeat === true) {
                id = setTimeout(func, delay)
            } else {
                xnode.finalize();
            }
        }
    });
}

//----------------------------------------------------------------------------------------------------
// iterative update
//----------------------------------------------------------------------------------------------------

(() => {
    requestAnimationFrame(ticker);

    function ticker() {
        XNode.updateTime = Date.now();
        XNode.roots.forEach((xnode) => xnode._update());
        requestAnimationFrame(ticker);
        XNode.updateCounter++;
    }
})();
