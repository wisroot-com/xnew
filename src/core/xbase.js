import { isObject, isString, isFunction, createElement, MapSet, MapMap, error } from './common';

export class XBase
{
    constructor(parent, element)
    {
        let baseElement = null;
        if (element instanceof Element || element instanceof Window || element instanceof Document) {
            baseElement = element;
        } else if (parent !== null) {
            baseElement = parent._.nestElement;
        } else if (document !== undefined) {
            baseElement = document.body;
        }

        this._ = {
            root: parent?._.root ?? this,   // root xnode
            parent,                         // parent xnode
            baseElement,                    // base element
            nestElement: baseElement,       // nest element
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
        return this._.nestElement;
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
        } else if (this._.nestElement) {
            this._.nestElement = this._.nestElement.appendChild(createElement(attributes));
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
            type.trim().split(/\s+/).forEach((type) => {
                XBase.on.call(this, type, listener, options);
            });
        }
    }

    off(type, listener)
    {
        if (type !== undefined && isString(type) === false) {
            error('xnode off', 'The argument is invalid.', 'type');
        } else if (listener !== undefined && isFunction(listener) === false) {
            error('xnode off', 'The argument is invalid.', 'listener');
        } else if (isString(type) === true && listener !== undefined) {
            type.trim().split(/\s+/).forEach((type) => {
                XBase.off.call(this, type, listener);
            });
        } else if (isString(type) === true && listener === undefined) {
            type.trim().split(/\s+/).forEach((type) => {
                this._.listeners.get(type)?.forEach((_, listener) => XBase.off.call(this, type, listener));
            });
        } else if (type === undefined) {
            this._.listeners.forEach((map, type) => {
                map.forEach((_, listener) => XBase.off.call(this, type, listener));
            });
        }
    }

    emit(type, ...args)
    {
        if (isString(type) === false) {
            error('xnode emit', 'The argument is invalid.', 'type');
        } else if (this._.state === 'finalized') {
            error('xnode emit', 'This function can not be called after finalized.');
        } else {
            type.trim().split(/\s+/).forEach((type) => {
                XBase.emit.call(this, type, ...args);
            });
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

        if (this._.baseElement) {
            let target = this._.nestElement;
            while (target.parentElement && target.parentElement !== this._.baseElement) {
                target = target.parentElement;
            }
            if (target.parentElement === this._.baseElement) {
                this._.baseElement.removeChild(target);
            }
            this._.nestElement = this._.baseElement;
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

    static context(name, value = undefined)
    {
        if (value !== undefined) {
            this._.context.set(name, value);
        } else {
            for (let xnode = this; xnode instanceof XBase; xnode = xnode.parent) {
                if (xnode._.context.has(name)) {
                    return xnode._.context.get(name);
                }
            }
        }
    }

    static etypes = new MapSet();
  
    static on(type, listener, options)
    {
        if (this._.listeners.has(type, listener) === false) {
            const [element, execute] = [this._.nestElement, (...args) => XBase.scope.call(this, listener, ...args)];
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

    static emit(type, ...args)
    {
        if (['~'].includes(type[0])) {
            XBase.etypes.get(type)?.forEach((xnode) => {
                if (xnode._.root === this._.root || type[0] === '#') {
                    xnode._.listeners.get(type)?.forEach(([element, execute]) => execute(...args));
                }
            });
        } else {
            this._.listeners.get(type)?.forEach(([element, execute]) => execute(...args));
        }
    }
}
