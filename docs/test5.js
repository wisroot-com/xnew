(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.window = global.window || {}));
})(this, (function (exports) { 'use strict';

    //----------------------------------------------------------------------------------------------------
    // type check
    //----------------------------------------------------------------------------------------------------

    function isString(value) {
        return typeof value === 'string';
    }

    function isFunction(value) {
        return typeof value === 'function';
    }

    function isObject(value) {
        return value !== null && typeof value === 'object' && value.constructor === Object;
    }

    class XNode {

        static current = null;

        static roots = new Set();
        
        static wrap(node, func, ...args) {
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

        static updateTime = null;

        static {
            (() => {
                requestAnimationFrame(ticker);
            
                function ticker() {
                    XNode.updateTime = Date.now();
                    XNode.roots.forEach((xnode) => xnode._update());
                    requestAnimationFrame(ticker);
                }
            })();
        }

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

            // state [pending -> running <-> stopped -> finalized]
            this._.state = 'pending';  

            // properties defined in the component function
            this._.defines = {};

            // conponent functions
            this._.ComponentSet = new Set();

            // event listners
            this._.listeners = new Map();

            // keys
            this._.keySet = new Set();

            // base ellement (fixed)
            this._.base = (this._.element instanceof Element) ? this._.element : (this._.parent ? this._.parent._.nest : document.body);

            // shared data between nodes connected by parent-child relationship
            this._.shared = this._.parent?._.shared ?? {};

            if (this._.parent === null || ['pending', 'running', 'stopped'].includes(this._.parent._.state)) {
                this._initialize();
            } else {
                this._.state = 'finalized';
            }
        }

        _initialize() {
            this._.nest = this._.base;

            if (isString(this._.content[0]) || isObject(this._.element)) {
                this.nest(isObject(this._.element) ? this._.element : {});
            }

            // auto start
            this.start();

            // content
            if (isFunction(this._.content[0])) {
                this._extend(...this._.content);
            } else if (isString(this._.content[0])) {
                this._.nest.innerHTML = this._.content[0];
            }

            // whether the node promise was resolved
            if (this._.defines.promise) {
                this._.resolve = false;
                this._.defines.promise?.then((response) => { this._.resolve = true; return response; });
            } else {
                this._.resolve = true;
            }
        }

        nest(attributes) {
            if (isObject(attributes) === false) {
                console.error('xnode nest: The arguments are invalid.');
            } else if (this._.state !== 'pending') {
                console.error('xnode nest: This can not be called after initialized.');
            } else {
                this.off();

                const element = attributes.tag === 'svg' ? 
                    document.createElementNS('http://www.w3.org/2000/svg', attributes.tag) : 
                    document.createElement(attributes.tag ?? 'div');
            
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

                this._.nest = this._.nest.appendChild(element);
            }

        }

        //----------------------------------------------------------------------------------------------------
        // basic
        //----------------------------------------------------------------------------------------------------
        
        get parent() {
            return this._.parent;
        }

        get element() {
            return this._.nest;
        }

        get shared() {
            return this._.shared;
        }

        get promise() {
            return this._.defines.promise ?? Promise.resolve();
        }

        get state() {
            return this._.state
        }

        //----------------------------------------------------------------------------------------------------
        // setup
        //----------------------------------------------------------------------------------------------------
     
        _extend(Component, ...args) {
            const defines = XNode.wrap(this, Component, this, ...args) ?? {};
            
            Object.keys(defines).forEach((key) => {
                const descripter = Object.getOwnPropertyDescriptor(defines, key);

                if (key === 'promise') {
                    if (descripter.value instanceof Promise) {
                        const previous = this._.defines[key];
                        this._.defines[key] = previous ? Promise.all([previous, descripter.value]) : descripter.value;
                    } else {
                        console.error('xnode extend: The type of "promise" is invalid.');
                    }
                } else if (['start', 'update', 'stop', 'finalize'].includes(key)) {
                    if (isFunction(descripter.value)) {
                        const previous = this._.defines[key];
                        this._.defines[key] = previous ? (...args) => { previous(...args); descripter.value(...args); } : descripter.value;
                    } else {
                        console.error(`xnode extend: The type of "${key}" is invalid.`);
                    }
                } else {
                    if (this._.defines[key] !== undefined || this[key] === undefined) {
                        const dest = { configurable: true, enumerable: true };

                        if (isFunction(descripter.value)) {
                            dest.value = (...args) => XNode.wrap(this, descripter.value, ...args);
                        } else if (descripter.value !== undefined) {
                            dest.value = descripter.value;
                        }
                        if (isFunction(descripter.get)) {
                            dest.get = (...args) => XNode.wrap(this, descripter.get, ...args);
                        }
                        if (isFunction(descripter.set)) {
                            dest.set = (...args) => XNode.wrap(this, descripter.set, ...args);
                        }

                        Object.defineProperty(this._.defines, key, dest);
                        Object.defineProperty(this, key, dest);
                    } else {
                        console.error(`xnode extend: "${key}" already exists, can not be redefined.`);
                    }
                }
            });

            const { promise, start, update, stop, finalize, ...others } = defines;
            return others;
        }

        extend(Component, ...args) {
            if (isFunction(Component) === false) {
                console.error('xnode extend: The arguments are invalid.');
            } else if (this._.state !== 'pending') {
                console.error('xnode extend: This can not be called after initialized.');
            } else if (this._.ComponentSet.has(Component) === false) {
                this._.ComponentSet .add(Component);
                return this._extend(Component, ...args);
            }
        }
      
        //----------------------------------------------------------------------------------------------------
        // system properties
        //----------------------------------------------------------------------------------------------------
     
        start() {
            this._.tostart = true;
        }

        stop() {
            this._.tostart = false;
            this._stop();
        }

        _start() {
            if (['pending', 'stopped'].includes(this._.state)) {
                if ((this._.parent === null || this._.parent.state === 'running') && this._.resolve === true && this._.tostart === true) {
                    this._.startTime = XNode.updateTime;
                    this._.state = 'running';
                    this._.children.forEach((node) => node._start());
                
                    if (this._.state === 'running' && isFunction(this._.defines.start)) {
                        XNode.wrap(this, this._.defines.start);
                    }
                }
            }
        }

        _stop() {
            if (['running'].includes(this._.state)) {
                this._.state = 'stopped';
                this._.children.forEach((node) => node._stop());

                if (this._.state === 'stopped' && isFunction(this._.defines.stop)) {
                    XNode.wrap(this, this._.defines.stop);
                }
            }
        }

        _update() {
            if (['pending', 'running', 'stopped'].includes(this._.state)) {
                if (this._.tostart === true) this._start();

                this._.children.forEach((node) => node._update());

                if (this._.state === 'running' && isFunction(this._.defines.update) === true) {
                    XNode.wrap(this, this._.defines.update, XNode.updateTime - this._.startTime);
                }
            }
        }

        finalize() {
            this._stop();

            if (['pending', 'stopped'].includes(this._.state)) {
                this._finalize();
                
                // relation
                (this._.parent?._.children ?? XNode.roots).delete(this);

                this._.state = 'finalized';
            }
        }

        _finalize() {
            [...this._.children].forEach((node) => node.finalize());
                
            if (isFunction(this._.defines.finalize)) {
                XNode.wrap(this, this._.defines.finalize);
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
            if (this._.nest !== null && this._.nest !== this._.base) {
                let target = this._.nest;
                while (target.parentElement !== null && target.parentElement !== this._.base) { target = target.parentElement; }
                if (target.parentElement === this._.base) {
                    this._.base.removeChild(target);
                }
            }
        }

        //----------------------------------------------------------------------------------------------------
        // context property
        //----------------------------------------------------------------------------------------------------        

        context(name, value = undefined) {
            if (isString(name) === false) {
                console.error('xnode context: The arguments are invalid.');
            } else {
                let ret = undefined;
                let node = this;
                while (node !== null) {
                    if (node._.context?.has(name)) {
                        ret = node._.context.get(name);
                    }
                    node = node.parent;
                }
                if (value !== undefined) {
                    this._.context = this._.context ?? new Map();
                    this._.context.set(name, value);
                }
                return ret;
            }
        }

        //----------------------------------------------------------------------------------------------------
        // key
        //----------------------------------------------------------------------------------------------------
       
        static keyMap = new Map();

        set key(key) {
            if (isString(key) === false) {
                console.error('xnode key: The arguments are invalid.');
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
                console.error('xnode on: The arguments are invalid.');
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
                    const wrapListener = (...args) => XNode.wrap(this, listener, ...args);

                    this._.listeners.get(type).set(listener, wrapListener);
                    this._.nest.addEventListener(type, wrapListener, options);
                }
            }
        }

        off(type, listener) {
            if ((type !== undefined && isString(type) === false) || (listener !== undefined && isFunction(listener) === false)) {
                console.error('xnode off: The arguments are invalid.');
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

                    this._.nest.removeEventListener(type, wrapListener);
                }
            }
        }

        emit(type, ...args) {
            if (isString(type) === false) {
                console.error('xnode emit: The arguments are invalid.');
            } else if (this._.state === 'finalized') {
                console.error('xnode emit: This can not be called after finalized.');
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

    function xnew(...args) {
        const e = document.createElement('div');
        e.innerText = 'aaa';
        document.body.appendChild(e);
        // a parent xnode
        let parent = undefined;
        if (args[0] instanceof XNode || args[0] === null || args[0] === undefined) {
            parent = args.shift();
        }


        let element = undefined;
        if (args[0] instanceof Element || isObject(args[0]) || args[0] === null || args[0] === undefined) {
            element = args.shift();
        }

        // Component function (+args), or innerHTML
        const content = args;

        return new XNode(parent, element, ...content);
    }

    exports.xnew = xnew;

}));
