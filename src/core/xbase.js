import { isObject, isString, isFunction, createElement, MapSet, MapMap, error } from './util';

export class XBase
{
    constructor(parent, element)
    {
        let base = null;
        if (element instanceof Element || element instanceof Window || element instanceof Document) {
            base = element;
        } else if (parent !== null) {
            base = parent._.nest;
        } else if (document !== undefined) {
            base = document.body;
        }

        this._ = {
            root: parent?._.root ?? this,   // root xnode
            parent,                         // parent xnode
            base,                           // base element
            nest: base,                     // nest element
            context: new Map(),             // context value
            keys: new Set(),                // keys
            listeners: new MapMap(),        // event listners
        };
    }

    get parent()
    {
        return this._.parent;
    }

    get element()
    {
        return this._.nest;
    }

    nest(attributes)
    {
        if (this.element instanceof Window) {
            error('xnode nest', 'No elements are added to window.');
        } else if (this.element instanceof Document) {
            error('xnode nest', 'No elements are added to document.');
        } else if (isObject(attributes) === false) {
            error('xnode nest', 'The argument is invalid.', 'attributes');
        } else if (this._.state !== 'pending') {
            error('xnode nest', 'This function can not be called after initialized.');
        } else if (this._.nest) {
            this._.nest = this._.nest.appendChild(createElement(attributes));
            return this.element;
        }
    }

    set key(key)
    {
        if (isString(key) === false) {
            error('xnode key', 'The argument is invalid.', 'key');
        } else {
            XBase.setkey.call(this, key);
        }
    }

    get key()
    {
        return XBase.getkey.call(this);
    }

    on(type, listener, options)
    {
        if (isString(type) === false) {
            error('xnode on', 'The argument is invalid.', 'type');
        } else if (isFunction(listener) === false) {
            error('xnode on', 'The argument is invalid.', 'listener');
        } else {
            type.trim().split(/\s+/).forEach((type) => XBase.on.call(this, type, listener, options));
        }
    }

    off(type, listener)
    {
        if (type !== undefined && isString(type) === false) {
            error('xnode off', 'The argument is invalid.', 'type');
        } else if (listener !== undefined && isFunction(listener) === false) {
            error('xnode off', 'The argument is invalid.', 'listener');
        } else if (isString(type) === true) {
            type.trim().split(/\s+/).forEach((type) => {
                const listners = listener ? [listener] : [...this._.listeners.get(type).keys()];
                listners.forEach((listener) => XBase.off.call(this, type, listener));
            });
        } else if (type === undefined) {
            this._.listeners.forEach((listener, type) => XBase.off.call(this, type, listener));
        }
    }

    emit(type, ...args)
    {
        if (isString(type) === false) {
            error('xnode emit', 'The argument is invalid.', 'type');
        } else if (this._.state === 'finalized') {
            error('xnode emit', 'This function can not be called after finalized.');
        } else {
            type.trim().split(/\s+/).forEach((type) => XBase.emit.call(this, type, ...args));
        }
    }

    //----------------------------------------------------------------------------------------------------
    // internal
    //----------------------------------------------------------------------------------------------------
    
    // root xnodes
    static roots = new Set();

    // current xnode scope
    static current = null;

    static scope(func, ...args)
    {
        const backup = XBase.current;
        try {
            XBase.current = this;
            return func(...args);
        } catch (error) {
            throw error;
        } finally {
            XBase.current = backup;
        }
    }

    static clear()
    {
        this.key = '';
        this._.context.clear();
        this.off();

        // delete nest element
        if (this._.base !== null && this._.nest !== this._.base) {
            let target = this._.nest;
            while (target.parentElement !== null && target.parentElement !== this._.base) { target = target.parentElement; }
            if (target.parentElement === this._.base) {
                this._.base.removeChild(target);
            }
            this._.nest = this._.base;
        }
    }

    static keys = new MapSet();
    
    static setkey(key)
    {
        this._.keys.forEach((key) => {
            XBase.keys.delete(key, this);
            this._.keys.delete(key);
        });
        key.trim().split(/\s+/).forEach((key) => {
            XBase.keys.add(key, this);
            this._.keys.add(key);
        });
    }

    static getkey()
    {
        return [...this._.keys].join(' ');
    }

    static context(name, value = undefined) {
        const ret = (() => {
            for (let xnode = this; xnode instanceof XBase; xnode = xnode.parent) {
                if (xnode._.context.has(name)) {
                    return xnode._.context.get(name);
                }
            }
        })();
        if (value !== undefined) {
            this._.context.set(name, value);
        } else {
            return ret;
        }
    }

    static etypes = new MapSet();
  
    static on(type, listener, options)
    {
        if (this._.listeners.has(type, listener) === false) {
            const element = this._.nest;
            const execute = (...args) => XBase.scope.call(this, listener, ...args);

            this._.listeners.set(type, listener, [element, execute]);
            element.addEventListener(type, execute, options);
        }
        if (this._.listeners.has(type) === true) {
            XBase.etypes.add(type, this);
        }
    }

    static off(type, listener)
    {
        if (this._.listeners.has(type, listener) === true) {
            const [element, execute] = this._.listeners.get(type, listener);

            this._.listeners.delete(type, listener);
            element.removeEventListener(type, execute);
        }
        if (this._.listeners.has(type) === false) {
            XBase.etypes.delete(type, this);
        }
    }

    static emit(type, ...args) {
        let token = null;
        if (['+', '#'].includes(type[0])) {
            token = type[0];
            type = type.substring(1);
        }
        if (XBase.etypes.has(type)) {
            if (token !== null) {
                const root = this._.root;
                XBase.etypes.get(type).forEach((xnode) => {
                    if (xnode._.root === root || token === '#') {
                        emit.call(xnode, type, ...args);
                    }
                });
            } else {
                emit.call(this, type, ...args);
            }
        }
        function emit(type, ...args) {
            if (this._.listeners.has(type) === true) {
                this._.listeners.get(type).forEach(([element, execute]) => execute(...args));
            }
        }
    }

}
