import { isString, isNumber, isObject, isFunction } from './common';

//----------------------------------------------------------------------------------------------------
// errors
//----------------------------------------------------------------------------------------------------

export const ERRORS = {
    ARGUMENT: 'The arguments are invalid.',
    BASIC_STRING: 'The arguments are invalid because it contains characters can not be used. Only [A-Z, a-z, 0-9, _, .] are available.', 
}

//----------------------------------------------------------------------------------------------------
// xnew
//----------------------------------------------------------------------------------------------------

export function xnew(...args) {

    // a parent node
    const parent = (args[0] instanceof XNode || args[0] === null || args[0] === undefined) ? args.shift() : undefined;

    // an existing html element or attributes to create a html element
    const element = (args[0] instanceof Element || isObject(args[0]) || args[0] === null || args[0] === undefined) ? args.shift() : undefined;

    // Component function (+args), or innerHTML
    const content = args;

    return new XNode(parent, element, ...content);
}

//----------------------------------------------------------------------------------------------------
// xwrap
//----------------------------------------------------------------------------------------------------

export function xwrap(node, func, ...args) {
    if (node === XNode.current) {
        return func(...args);
    } else {
        const backup = XNode.current;
        try {
            XNode.current = node;
            return func(...args);
        } catch (error) {
            throw error;
        } finally {
            XNode.current = backup;
        }
    }
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
            XNode.keyMap.get(key).forEach((node) => set.add(node));
        });
        return [...set];
    }
}

//----------------------------------------------------------------------------------------------------
// xtimer
//----------------------------------------------------------------------------------------------------

export function xtimer(callback, delay, repeat = false) {
    
    return xnew((node) => {
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
            xwrap(node.parent, callback);
            counter++;
            if (repeat === true) {
                id = setTimeout(func, delay)
            } else {
                node.finalize();
            }
        }
    });
}

//----------------------------------------------------------------------------------------------------
// node
//----------------------------------------------------------------------------------------------------

export class XNode {

    static current = null;

    static roots = new Set();
  
    constructor(parent, element, ...content) {
        // internal data
        this._ = {};

        this._.parent = (parent instanceof XNode || parent === null) ? parent : XNode.current;
        this._.element = element;
        this._.content = content;

        // relation
        (this._.parent?._.children ?? XNode.roots).add(this);
        this._.children = new Set();

        this._.root = this._.parent !== null ? this._.parent.root : this;

        // phase [pre initialized ->stopped ->started ->... ->stopped ->pre finalized ->finalized]
        this._.phase = 'pre initialized';  

        // properties defined in the component function
        this._.defines = {};

        // conponent functions
        this._.ComponentSet = new Set();

        // event listners
        this._.listeners = new Map();

        // keys
        this._.keySet = new Set();

        // base ellement (fixed)
        this._.baseElement = (this._.element instanceof Element) ? this._.element : (this._.parent ? this._.parent._.nestElement : document.body);

        // shared data between nodes connected by parent-child relationship
        this._.shared = this._.parent?._.shared ?? {};

        if (this._.parent === null || this._.parent._.phase === 'pre initialized' || this._.parent._.phase === 'stopped' || this._.parent._.phase === 'started') {
            this._initialize();

            this._.phase = 'stopped';
        } else {
            this._.phase = 'finalized';
        }
    }

    _initialize() {
        this._.nestElement = this._.baseElement;

        if (isString(this._.content[0]) || isObject(this._.element)) {
            this.nestElement(isObject(this._.element) ? this._.element : {})
        }

        // auto start
        this.start();

        // content
        if (isFunction(this._.content[0])) {
            this._extend(...this._.content);
        } else if (isString(this._.content[0])) {
            this._.nestElement.innerHTML = this._.content[0];
        }

        // whether the node promise was resolved
        if (this._.defines.promise) {
            this._.resolve = false;
            this._.defines.promise?.then((response) => { this._.resolve = true; return response; });
        } else {
            this._.resolve = true;
        }
    }

    nestElement(attributes) {
        if (isObject(attributes) === false) {
            console.error('XNode nestElement: ' + ERRORS.ARGUMENT);
        } else if (this._.phase !== 'pre initialized') {
            console.error('XNode nestElement: ' + 'This can not be called after initialized.');
        } else {
            this.off();
            this._.nestElement = this._.nestElement.appendChild(createElement(attributes));
        }
    }

    //----------------------------------------------------------------------------------------------------
    // basic
    //----------------------------------------------------------------------------------------------------
    
    get parent() {
        return this._.parent;
    }

    get element() {
        return this._.nestElement;
    }

    get shared() {
        return this._.shared;
    }

    //----------------------------------------------------------------------------------------------------
    // setup
    //----------------------------------------------------------------------------------------------------
 
    _extend(Component, ...args) {
        const defines = xwrap(this, Component, this, ...args) ?? {};
        
        Object.keys(defines).forEach((key) => {
            const descripter = Object.getOwnPropertyDescriptor(defines, key);

            if (key === 'promise') {
                if (descripter.value instanceof Promise) {
                    const previous = this._.defines[key];
                    this._.defines[key] = previous ? Promise.all([previous, descripter.value]) : descripter.value;
                } else {
                    console.error('XNode define: ' + 'the type of "promise" is invalid.');
                }
            } else if (['start', 'update', 'stop', 'finalize'].includes(key)) {
                if (isFunction(descripter.value)) {
                    const previous = this._.defines[key];
                    this._.defines[key] = previous ? (...args) => { previous(...args); descripter.value(...args); } : descripter.value;
                } else {
                    console.error('XNode define: ' + `the type of "${key}" is invalid.`);
                }
            } else {
                if (this._.defines[key] !== undefined || this[key] === undefined) {
                    const dest = { configurable: true, enumerable: true };

                    if (isFunction(descripter.value)) {
                        dest.value = (...args) => xwrap(this, descripter.value, ...args);
                    } else if (descripter.value !== undefined) {
                        dest.value = descripter.value;
                    }
                    if (isFunction(descripter.get)) {
                        dest.get = (...args) => xwrap(this, descripter.get, ...args);
                    }
                    if (isFunction(descripter.set)) {
                        dest.set = (...args) => xwrap(this, descripter.set, ...args);
                    }

                    Object.defineProperty(this._.defines, key, dest);
                    Object.defineProperty(this, key, dest);
                } else {
                    console.error('XNode define: ' + `"${key}" already exists, can not be redefined.`);
                }
            }
        });

        const { promise, start, update, stop, finalize, ...others } = defines;
        return others;
    }

    extend(Component, ...args) {
        if (isFunction(Component) === false) {
            console.error('XNode extend: ' + ERRORS.ARGUMENT);
        } else if (this._.phase !== 'pre initialized') {
            console.error('XNode extend: ' + 'This can not be called after initialized.');
        } else if (this._.ComponentSet.has(Component) === false) {
            this._.ComponentSet .add(Component);
            return this._extend(Component, ...args);
        }
    }
  
    //----------------------------------------------------------------------------------------------------
    // system properties
    //----------------------------------------------------------------------------------------------------
 
    static updateCounter = 0;

    static updateTime = null;

    get promise() {
        return this._.defines.promise ?? Promise.resolve();
    }

    start() {
        this._.tostart = true;
    }

    stop() {
        this._.tostart = false;
        this._stop();
    }

    _start() {
        if (this._.phase === 'stopped' && (this._.parent === null || this._.parent.isStarted()) && this._.resolve === true && this._.tostart === true) {
            this._.startTime = XNode.updateTime;
            this._.phase = 'started';
            this._.children.forEach((node) => node._start());
        
            if (this._.phase === 'started' && isFunction(this._.defines.start)) {
                xwrap(this, this._.defines.start);
            }
        }
    }

    _stop() {
        if (this._.phase === 'started') {
            this._.phase = 'stopped';
            this._.children.forEach((node) => node._stop());

            if (this._.phase === 'stopped' && isFunction(this._.defines.stop)) {
                xwrap(this, this._.defines.stop);
            }
        }
    }

    _update() {

        if (this._.phase === 'started' || this._.phase === 'stopped') {
            if (this._.tostart === true) this._start();

            this._.children.forEach((node) => node._update());

            if (this._.phase === 'started' && isFunction(this._.defines.update) === true) {
                xwrap(this, this._.defines.update, XNode.updateTime - this._.startTime);
            }
        }
    }

    finalize() {
        this._stop();

        if (this._.phase === 'stopped') {
            this._.phase = 'pre finalized';

            this._finalize();
            
            // relation
            (this._.parent?._.children ?? XNode.roots).delete(this);

            this._.phase = 'finalized';
        }
    }

    _finalize() {
        [...this._.children].forEach((node) => node.finalize());
            
        if (isFunction(this._.defines.finalize)) {
            xwrap(this, this._.defines.finalize);
        }

        // key
        this.key = '';

        // event
        this.off();
        
        // reset define
        Object.keys(this._.defines).forEach((key) => {
            if (['promise', 'start', 'update', 'stop', 'finalize'].includes(key)) {
                delete this._.defines[key];
            } else {
                delete this._.defines[key];
                delete this[key];
            }
        });

        // element
        if (this._.nestElement !== null && this._.nestElement !== this._.baseElement) {
            let target = this._.nestElement;
            while (target.parentElement !== null && target.parentElement !== this._.baseElement) { target = target.parentElement; }
            if (target.parentElement === this._.baseElement) {
                this._.baseElement.removeChild(target);
            }
        }
    }

    isStarted() {
        return this._.phase === 'started';
    }

    isStopped() {
        return this._.phase !== 'started';
    }

    isFinalized() {
        return this._.phase === 'finalized';
    }


    //----------------------------------------------------------------------------------------------------
    // context property
    //----------------------------------------------------------------------------------------------------        

    setContext(name, value) {
        if (isString(name) === false) {
            console.error('XNode setContext: ' + ERRORS.ARGUMENT);
        } else if (isBasicString(name) === false) {
            console.error('XNode setContext: ' + ERRORS.BASIC_STRING);
        } else {
            this._.context = this._.context ?? new Map();
            this._.context.set(name, value ?? null);
        }
    }

    getContext(name) {
        if (isString(name) === false) {
            console.error('XNode getContext: ' + ERRORS.ARGUMENT);
        } else if (isBasicString(name) === false) {
            console.error('XNode getContext: ' + ERRORS.BASIC_STRING);
        } else {
            let value = undefined;
            let node = this;
            while (node !== null) {
                if (node._.context?.has(name)) {
                    value = node._.context.get(name);
                    break;
                }
                node = node.parent;
            }
            return value;
        }
    }

    //----------------------------------------------------------------------------------------------------
    // key
    //----------------------------------------------------------------------------------------------------
   
    static keyMap = new Map();

    set key(key) {
        if (isString(key) === false) {
            console.error('XNode key: ' + ERRORS.ARGUMENT);
        } else {
            // clear all
            this._.keySet.forEach((key) => {
                if (XNode.keyMap.has(key) === false) return;
                XNode.keyMap.get(key).delete(this);
                if (XNode.keyMap.get(key).size === 0) XNode.keyMap.delete(key);
                this._.keySet.delete(key);
            });

            // set keys
            key.split(' ').filter((key) => key !== '').forEach((key) => {
                if (XNode.keyMap.has(key) === false) XNode.keyMap.set(key, new Set());
                XNode.keyMap.get(key).add(this);
                this._.keySet.add(key);
            });
        }
    }

    get key() {
        return [...this._.keySet].join(' ');
    }
    
    //----------------------------------------------------------------------------------------------------
    // event
    //----------------------------------------------------------------------------------------------------
   
    static eventTypeMap = new Map();
    
    on(type, listener, options) {
        if (isString(type) === false || isFunction(listener) === false) {
            console.error('XNode on: ' + ERRORS.ARGUMENT);
        } else if (isEventType(type) === false) {
            console.error('XNode on: ' + ERRORS.BASIC_STRING);
        } else {
            type.split(' ').filter((type) => type !== '').forEach((type) => {

                addEventListener.call(this, type, listener, options);

                if (XNode.eventTypeMap.has(type) === false) XNode.eventTypeMap.set(type, new Set());
                if (XNode.eventTypeMap.get(type).has(this) === false) {
                    XNode.eventTypeMap.get(type).add(this);
                }
            });
        }

        function addEventListener(type, listener, options) {
            if (this._.listeners.has(type) === false) this._.listeners.set(type, new Map());
            if (this._.listeners.get(type).has(listener) === false) {
                const wrapListener = (...args) => xwrap(this, listener, ...args);

                this._.listeners.get(type).set(listener, wrapListener);
                this._.nestElement.addEventListener(type, wrapListener, options);
            }
        }
    }

    off(type, listener) {
        if ((type !== undefined && isString(type) === false) || (listener !== undefined && isFunction(listener) === false)) {
            console.error('XNode off: ' + ERRORS.ARGUMENT);
        } else if (type !== undefined && isEventType(type) === false) {
            console.error('XNode off: ' + ERRORS.BASIC_STRING);
        } else {
            type = type ?? [...this._.listeners.keys()].join(' ');

            type.split(' ').filter((type) => type !== '').forEach((type) => {
                
                if (this._.listeners.has(type) === true) {
                    if (isFunction(listener) === true) {
                        removeEventListener.call(this, type, listener);
                    } else if (listener === undefined) {
                        [...this._.listeners.get(type).keys()].forEach((listener) => removeEventListener.call(this, type, listener));
                    }

                    if (this._.listeners.has(type) === false && XNode.eventTypeMap.has(type) === true) {
                        XNode.eventTypeMap.get(type).delete(this);
                        if (XNode.eventTypeMap.get(type).size === 0) XNode.eventTypeMap.delete(type);
                    }
                }
            });
        }

        function removeEventListener(type, listener) {
            if (this._.listeners.has(type) === true && this._.listeners.get(type).has(listener) === true) {
                const wrapListener = this._.listeners.get(type).get(listener);

                this._.listeners.get(type).delete(listener);
                if (this._.listeners.get(type).size === 0) this._.listeners.delete(type);

                this._.nestElement.removeEventListener(type, wrapListener);
            }
        }
    }

    emit(type, ...args) {
        if (isString(type) === false) {
            console.error('XNode emit: ' + ERRORS.ARGUMENT);
        } else if (this._.phase === 'finalized') {
            console.error('XNode emit: ' + 'This can not be called after finalized.');
        } else {
            type.split(' ').filter((type) => type !== '').forEach((type) => {
                if (type[0] === '#') {
                    if (XNode.eventTypeMap.has(type)) {
                        XNode.eventTypeMap.get(type).forEach((node) => emit.call(node, type, ...args));
                    }
                } else {
                    emit.call(this, type, ...args);
                }
            });
        }

        function emit(type, ...args) {
            if (this._.listeners.has(type) === true) {
                this._.listeners.get(type).forEach((listener) => listener(...args));
            }
        }
    }
}

//----------------------------------------------------------------------------------------------------
// iterative update
//----------------------------------------------------------------------------------------------------

(() => {
    requestAnimationFrame(ticker);

    function ticker() {
        XNode.updateTime = Date.now();
        XNode.roots.forEach((node) => node._update());
        requestAnimationFrame(ticker);
        XNode.updateCounter++;
    }
})();


//----------------------------------------------------------------------------------------------------
// create element
//----------------------------------------------------------------------------------------------------

function createElement(attributes) {

    const element = (() => {
        if (attributes.tag == 'svg') {
            return document.createElementNS('http://www.w3.org/2000/svg', attributes.tag);
        } else {
            return document.createElement(attributes.tag ?? 'div');
        }
    })();

    Object.keys(attributes).forEach((key) => {
        const value = attributes[key];
        if (key === 'style') {
            if (isString(value) === true) {
                element.style = value;
            } else if (isObject(value) === true){
                Object.assign(element.style, value);
            }
        } else if (key === 'class') {
            if (isString(value) === true) {
                element.classList.add(...value.split(' '));
            }
        } else if (['checked', 'disabled', 'readonly'].includes(key)) {
            const remap = { checked: 'checked', disabled: 'disabled', readonly: 'readOnly', };
            element[remap[key]] = value;
        } else if (key !== 'tag') {
            element.setAttribute(key, value);
        }
    });
    return element;
}

//----------------------------------------------------------------------------------------------------
// util
//----------------------------------------------------------------------------------------------------

function isBasicString(value) {
    return isString(value) === true && value.match(/^[A-Za-z0-9_.]*$/) !== null;
}

function isEventType(type) {
    const types = type.split(' ').filter((type) => type !== '');
    return types.find((type) => isBasicString(type[0] === '#' ? type.slice(1) : type) === false) === undefined;
}