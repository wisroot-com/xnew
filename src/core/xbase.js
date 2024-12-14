import { isObject, isString, isFunction, error } from './util';

export class XBase {
    constructor(parent, element, component) {
        const root = parent?._.root ?? this;
        const base = (element instanceof Element || element instanceof Window || element instanceof Document) ? element : (parent?._.nest ?? document?.body ?? null);

        this._ = {
            backup: [parent, element, component],

            root,                           // root xnode
            parent,                         // parent xnode
            base,                           // base element

            context: new Map(),             // context value
            keys: new Set(),                // keys
        };
    }

    get parent()
    {
        return this._.parent;
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

    //----------------------------------------------------------------------------------------------------
    // internal
    //----------------------------------------------------------------------------------------------------
    
    static clear()
    {
        this._.keys.clear();
        this._.context.clear();
    }

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

    static keys = new Map();
    
    static setkey(key)
    {
        // clear all
        this._.keys.forEach((key) => {
            XBase.keys.get(key).delete(this);
            if (XBase.keys.get(key).size === 0) {
                XBase.keys.delete(key);
            }
            this._.keys.delete(key);
        });

        key.trim().split(/\s+/).forEach((key) => {
            if (XBase.keys.has(key) === false) {
                XBase.keys.set(key, new Set());
            }
            XBase.keys.get(key).add(this);
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
}
