import { isString, isNumber, isObject, isFunction, error, createElement } from './common';

export class XNode {

    constructor(parent, element, component, ...args) {
        parent = (parent instanceof XNode || parent === null) ? parent : XNode.current;
        (parent?._.children ?? XNode.roots).add(this);

        const root = parent !== null ? parent._.root : this;
        const base = (element instanceof Element || element instanceof Window) ? element : (parent?._.nest ?? document?.body ?? null);

        this._ = {
            root,                           // root xnode
            base,                           // base element
            nest: base,                     // nest element
            parent,                         // parent xnode
            children: new Set(),            // xhildren xnodes
            state: 'pending',               // [pending -> running <-> stopped -> finalized]
            tostart: false,                 // flag for start
            resolve: false,                 // promise
            props: {},                      // properties in the component function
            components: new Set(),          // component functions
            listeners: new Map(),           // event listners
            context: new Map(),             // context value
            keys: new Set(),                // keys
            shared: parent?._.shared ?? {}, // shared data
        };

        if (parent !== null && ['finalized'].includes(parent._.state)) {
            this._.state = 'finalized';
            return;
        }

        this.start(); // auto start
    
        if (isObject(element) === true) {
            this.nest(element)
        }

        if (isFunction(component) === true) {
            XNode.extend.call(this, component, ...args)
        } else if (isObject(element) === true && isString(component) === true) {
            this._.nest.innerHTML = component;
        }

        // whether the xnode promise was resolved
        if (this._.props.promise) {
            this._.props.promise?.then((response) => { this._.resolve = true; return response; });
        } else {
            this._.resolve = true;
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

    nest(attributes) {
        if (this._.nest instanceof Window) {
            error('xnode nest', 'No elements are added to window.');
        } else if (isObject(attributes) === false) {
            error('xnode nest', 'The argument is invalid.', 'attributes');
        } else if (this._.state !== 'pending') {
            error('xnode nest', 'This function can not be called after initialized.');
        } else {
            this.off();
            this._.nest = this._.nest.appendChild(createElement(attributes));
        }
    }

    extend(component, ...args) {
        if (isFunction(component) === false) {
            error('xnode extend', 'The argument is invalid.', 'component');
        } else if (this._.state !== 'pending') {
            error('xnode extend', 'This function can not be called after initialized.');
        } else if (this._.components.has(component) === false) {
            this._.components.add(component);
            return XNode.extend.call(this, component, ...args);
        }
    }

    start() {
        this._.tostart = true;
    }

    stop() {
        this._.tostart = false;
        XNode.stop.call(this);
    }

    finalize() {
        XNode.stop.call(this);
        XNode.finalize.call(this);
    }

    //----------------------------------------------------------------------------------------------------
    // auxiliary
    //----------------------------------------------------------------------------------------------------        

    context(name, value = undefined) {
        if (isString(name) === false) {
            error('xnode context', 'The arguments are invalid.');
        } else {
            const ret = (() => {
                for (let xnode = this; xnode !== null; xnode = xnode.parent) {
                    if (xnode._.context?.has(name)) {
                        return xnode._.context.get(name);
                    }
                }
            })();
            if (value !== undefined) {
                this._.context.set(name, value);
            }
            return ret;
        }
    }

    set key(key) {
        if (isString(key) === false) {
            error('xnode key', 'The arguments are invalid.');
        } else {
            // clear all
            this._.keys.forEach((key) => {
                if (XNode.keys.has(key) === false) return;
                XNode.keys.get(key).delete(this);
                if (XNode.keys.get(key).size === 0) XNode.keys.delete(key);
                this._.keys.delete(key);
            });

            // set keys
            key.split('/\s+/').forEach((key) => {
                if (XNode.keys.has(key) === false) XNode.keys.set(key, new Set());
                XNode.keys.get(key).add(this);
                this._.keys.add(key);
            });
        }
    }

    get key() {
        return [...this._.keys].join(' ');
    }
    
    on(type, listener, options) {
        if (isString(type) === false) {
            error('xnode on', 'The arguments are invalid.', 'type');
        } else if (isFunction(listener) === false) {
            error('xnode on', 'The arguments are invalid.', 'listener');
        } else {
            type.split(/\s+/).forEach((type) => XNode.on.call(this, type, listener, options));
        }
    }

    off(type, listener) {
        if (type !== undefined && isString(type) === false) {
            error('xnode off', 'The argument is invalid.', 'type');
        } else if (listener !== undefined && isFunction(listener) === false) {
            error('xnode off', 'The argument is invalid.', 'listener');
        } else if (isString(type) === true) {
            type.split(/\s+/).forEach((type) => XNode.off.call(this, type, listener));
        } else if (type === undefined && this._.listeners.size !== 0) {
            [...this._.listeners.keys()].forEach((type) => XNode.off.call(this, type, listener));
        }
    }

    emit(type, ...args) {
        if (isString(type) === false) {
            error('xnode emit', 'The argument is invalid.', 'type');
        } else if (this._.state === 'finalized') {
            error('xnode emit', 'This function can not be called after finalized.');
        } else {
            type.split(/\s+/).forEach((type) => XNode.emit.call(this, type, ...args));
        }
    }

    //----------------------------------------------------------------------------------------------------
    // static
    //----------------------------------------------------------------------------------------------------
    
    static roots = new Set();  // root xnodes
    static animation = null;   // animation callback id
    static current = null;     // current xnode scope
    static keys = new Map();   // key map
    static etypes = new Map(); // event type map

    static reset() {
        XNode.roots.forEach((xnode) => xnode.finalize());
        XNode.roots.clear();

        if (XNode.animation) {
            cancelAnimationFrame(XNode.animation);
        }
        XNode.animation = requestAnimationFrame(ticker);
        function ticker() {
            const time = Date.now();
            XNode.roots.forEach((xnode) => XNode.update.call(xnode, time));
            XNode.animation = requestAnimationFrame(ticker);
        }
    }

    static wrap(func, ...args) {
        const backup = XNode.current;
        try {
            XNode.current = this;
            return func(...args);
        } catch (error) {
            throw error;
        } finally {
            XNode.current = backup;
        }
    }

    static extend(component, ...args) {
        const props = XNode.wrap.call(this, component, this, ...args) ?? {};
        
        Object.keys(props).forEach((key) => {
            const descripter = Object.getOwnPropertyDescriptor(props, key);

            if (key === 'promise') {
                if (descripter.value instanceof Promise) {
                    const previous = this._.props[key];
                    this._.props[key] = previous ? Promise.all([previous, descripter.value]) : descripter.value;
                } else {
                    error('xnode extend', 'The property is invalid.', 'promise');
                }
            } else if (['start', 'update', 'stop', 'finalize'].includes(key)) {
                if (isFunction(descripter.value)) {
                    const previous = this._.props[key];
                    this._.props[key] = previous ? (...args) => { previous(...args); descripter.value(...args); } : descripter.value;
                } else {
                    error('xnode extend', 'The property is invalid.', key);
                }
            } else {
                if (this._.props[key] !== undefined || this[key] === undefined) {
                    const dest = { configurable: true, enumerable: true };

                    if (isFunction(descripter.value) === true) {
                        dest.value = (...args) => XNode.wrap.call(this, descripter.value, ...args);
                    } else if (descripter.value !== undefined) {
                        dest.value = descripter.value;
                    }
                    if (isFunction(descripter.get) === true) {
                        dest.get = (...args) => XNode.wrap.call(this, descripter.get, ...args);
                    }
                    if (isFunction(descripter.set) === true) {
                        dest.set = (...args) => XNode.wrap.call(this, descripter.set, ...args);
                    }

                    Object.defineProperty(this._.props, key, dest);
                    Object.defineProperty(this, key, dest);
                } else {
                    error('xnode extend', 'The property already exists.', key);
                }
            }
        });

        const { promise, start, update, stop, finalize, ...others } = props;
        return others;
    }

    static start(time) {
        if (['pending', 'stopped'].includes(this._.state) && this._.resolve === true && this._.tostart === true) {
            if (this._.parent === null || ['running'].includes(this._.parent.state)) {
                this._.startTime = time;
                this._.state = 'running';
                this._.children.forEach((xnode) => XNode.start.call(xnode, time));
            
                if (this._.state === 'running' && isFunction(this._.props.start) === true) {
                    XNode.wrap.call(this, this._.props.start);
                }
            }
        }
    }

    static stop() {
        if (['running'].includes(this._.state)) {
            this._.state = 'stopped';
            this._.children.forEach((xnode) => XNode.stop.call(xnode));

            if (this._.state === 'stopped' && isFunction(this._.props.stop)) {
                XNode.wrap.call(this, this._.props.stop);
            }
        }
    }

    static update(time) {
        if (['pending', 'running', 'stopped'].includes(this._.state)) {
            if (this._.tostart === true) XNode.start.call(this, time);

            this._.children.forEach((xnode) => XNode.update.call(xnode, time));

            if (this._.state === 'running' && isFunction(this._.props.update) === true) {
                XNode.wrap.call(this, this._.props.update, time - this._.startTime);
            }
        }
    }

    static finalize() {
        if (['pending', 'stopped'].includes(this._.state)) {
            this._.state = 'finalized';
            
            [...this._.children].forEach((xnode) => xnode.finalize());
            
            if (isFunction(this._.props.finalize)) {
                XNode.wrap.call(this, this._.props.finalize);
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

            (this._.parent?._.children ?? XNode.roots).delete(this);
        }
    }

    static on(type, listener, options) {
        if (this._.listeners.has(type) === false) {
            this._.listeners.set(type, new Map());
        }
        if (this._.listeners.get(type).has(listener) === false) {
            const wrap = (...args) => XNode.wrap.call(this, listener, ...args);

            this._.listeners.get(type).set(listener, wrap);
            this._.nest.addEventListener(type, wrap, options);
        }
        
        if (XNode.etypes.has(type) === false) {
            XNode.etypes.set(type, new Set());
        }
        if (XNode.etypes.get(type).has(this) === false) {
            XNode.etypes.get(type).add(this);
        }
    }

    static off(type, listener) {
        if (this._.listeners.has(type) === false) {
            return;
        }
        const listners = listener ? [listener] : [...this._.listeners.get(type).keys()];
        listners.forEach((listener) => {
            if (this._.listeners.has(type) === true && this._.listeners.get(type).has(listener) === true) {
                const wrap = this._.listeners.get(type).get(listener);
    
                this._.listeners.get(type).delete(listener);
                if (this._.listeners.get(type).size === 0) this._.listeners.delete(type);
    
                this._.nest.removeEventListener(type, wrap);
            }
            if (this._.listeners.has(type) === false && XNode.etypes.has(type) === true) {
                XNode.etypes.get(type).delete(this);
                if (XNode.etypes.get(type).size === 0) XNode.etypes.delete(type);
            }
        });
    }

    static emit(type, ...args) {
        if (XNode.etypes.has(type)) {
            if (['#', '+'].includes(type[0])) {
                const root = this._.root;
                XNode.etypes.get(type).forEach((xnode) => {
                    if (type[0] === '#' || xnode._.root === root) {
                        emit.call(xnode, type, ...args);
                    }
                });
            } else {
                emit.call(this, type, ...args);
            }
        }
        function emit(type, ...args) {
            if (this._.listeners.has(type) === true) {
                this._.listeners.get(type).forEach((listener) => listener(...args));
            }
        }
    }
}

XNode.reset();