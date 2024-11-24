import { isString, isNumber, isObject, isFunction } from './common';

export class XNode {

    static roots = new Set();
  
    static animation = null;

    static initialize() {
        XNode.roots.forEach((xnode) => xnode.finalize());

        if (XNode.animation) {
            cancelAnimationFrame(XNode.animation);
        }
        XNode.animation = requestAnimationFrame(ticker);
        function ticker() {
            const time = Date.now();
            XNode.roots.forEach((xnode) => xnode._update(time));
            XNode.animation = requestAnimationFrame(ticker);
        }
    }

    static current = null;

    static wrap(node, func, ...args) {
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

    constructor(parent, element, ...args) {
        parent = (parent instanceof XNode || parent === null) ? parent : XNode.current;
        (parent?._.children ?? XNode.roots).add(this);

        const root = parent !== null ? parent.root : this;
        const base = element instanceof Element ? element : (parent ? parent._.nest : document.body);

        this._ = {
            root,                           // root xnode
            base,                           // base element
            nest: base,                     // nest element
            parent,                         // parent xnode
            children: new Set(),            // xhildren xnodes
            state: 'pending',               // [pending -> running <-> stopped -> finalized]
            props: {},                      // properties in the component function
            components: new Set(),          // conponent functions
            listeners: new Map(),           // event listners
            keys: new Set(),                // keys
            shared: parent?._.shared ?? {}, // shared data between nodes connected
        };

        if (parent === null || ['pending', 'running', 'stopped'].includes(parent._.state)) {
            this._initialize(element, args);
        } else {
            this._.state = 'finalized';
        }
    }

    _initialize(element, args) {
        this.start(); // auto start
    
        if (isObject(element) && (element instanceof Element) === false) {
            this.nest(element)
        } else if (isString(args[0])) {
            this.nest(isObject(element) ? element : {})
        }

        if (isFunction(args[0])) {
            this._extend(...args);
        } else if (isString(args[0])) {
            this._.nest.innerHTML = args[0];
        }

        // whether the node promise was resolved
        if (this._.props.promise) {
            this._.resolve = false;
            this._.props.promise?.then((response) => { this._.resolve = true; return response; });
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
                document.createElementNS('http://www.w3.org/2000/svg', 'svg') : 
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
        return this._.props.promise ?? Promise.resolve();
    }
    get state() {
        return this._.state
    }

    //----------------------------------------------------------------------------------------------------
    // setup
    //----------------------------------------------------------------------------------------------------
 
    _extend(Component, ...args) {
        const props = XNode.wrap(this, Component, this, ...args) ?? {};
        
        Object.keys(props).forEach((key) => {
            const descripter = Object.getOwnPropertyDescriptor(props, key);

            if (key === 'promise') {
                if (descripter.value instanceof Promise) {
                    const previous = this._.props[key];
                    this._.props[key] = previous ? Promise.all([previous, descripter.value]) : descripter.value;
                } else {
                    console.error('xnode extend: The type of "promise" is invalid.');
                }
            } else if (['start', 'update', 'stop', 'finalize'].includes(key)) {
                if (isFunction(descripter.value)) {
                    const previous = this._.props[key];
                    this._.props[key] = previous ? (...args) => { previous(...args); descripter.value(...args); } : descripter.value;
                } else {
                    console.error(`xnode extend: The type of "${key}" is invalid.`);
                }
            } else {
                if (this._.props[key] !== undefined || this[key] === undefined) {
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

                    Object.defineProperty(this._.props, key, dest);
                    Object.defineProperty(this, key, dest);
                } else {
                    console.error(`xnode extend: "${key}" already exists, can not be redefined.`);
                }
            }
        });

        const { promise, start, update, stop, finalize, ...others } = props;
        return others;
    }

    extend(Component, ...args) {
        if (isFunction(Component) === false) {
            console.error('xnode extend: The arguments are invalid.');
        } else if (this._.state !== 'pending') {
            console.error('xnode extend: This can not be called after initialized.');
        } else if (this._.components.has(Component) === false) {
            this._.components .add(Component);
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

    _start(time) {
        if (['pending', 'stopped'].includes(this._.state) && this._.resolve === true && this._.tostart === true) {
            if (this._.parent === null || ['running'].includes(this._.parent.state)) {
                this._.startTime = time;
                this._.state = 'running';
                this._.children.forEach((node) => node._start(time));
            
                if (this._.state === 'running' && isFunction(this._.props.start)) {
                    XNode.wrap(this, this._.props.start);
                }
            }
        }
    }

    _stop() {
        if (['running'].includes(this._.state)) {
            this._.state = 'stopped';
            this._.children.forEach((node) => node._stop());

            if (this._.state === 'stopped' && isFunction(this._.props.stop)) {
                XNode.wrap(this, this._.props.stop);
            }
        }
    }

    _update(time) {
        if (['pending', 'running', 'stopped'].includes(this._.state)) {
            if (this._.tostart === true) this._start(time);

            this._.children.forEach((node) => node._update(time));

            if (this._.state === 'running' && isFunction(this._.props.update) === true) {
                XNode.wrap(this, this._.props.update, time - this._.startTime);
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
            
        if (isFunction(this._.props.finalize)) {
            XNode.wrap(this, this._.props.finalize);
        }

        this.key = '';
        this.off();
        
        // reset props
        Object.keys(this._.props).forEach((key) => {
            if (['promise', 'start', 'update', 'stop', 'finalize'].includes(key)) {
                delete this._.props[key];
            } else {
                delete this._.props[key];
                delete this[key];
            }
        });

        // delete nest element
        if (this._.nest !== this._.base) {
            let target = this._.nest;
            while (target.parentElement !== null && target.parentElement !== this._.base) { target = target.parentElement; }
            if (target.parentElement === this._.base) {
                this._.base.removeChild(target);
            }
        }
    }

    //----------------------------------------------------------------------------------------------------
    // context value
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
            this._.keys.forEach((key) => {
                if (XNode.keyMap.has(key) === false) return;
                XNode.keyMap.get(key).delete(this);
                if (XNode.keyMap.get(key).size === 0) XNode.keyMap.delete(key);
                this._.keys.delete(key);
            });

            // set keys
            key.split(' ').filter((key) => key !== '').forEach((key) => {
                if (XNode.keyMap.has(key) === false) XNode.keyMap.set(key, new Set());
                XNode.keyMap.get(key).add(this);
                this._.keys.add(key);
            });
        }
    }

    get key() {
        return [...this._.keys].join(' ');
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

XNode.initialize();
