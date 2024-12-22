import { isObject, isString, isFunction, createElement, MapSet, MapMap, error } from './util';

export class XBase
{
    constructor(parent, element)
    {
        let baseElement = null;
        if (element instanceof Element || element instanceof Window || element instanceof Document) {
            baseElement = element;
        } else if (parent !== null) {
            baseElement = parent.element;
        } else if (document instanceof Document) {
            baseElement = document.body;
        }

        this._ = {
            parent,                         // parent xnode
            baseElement,                    // base element
            nestElements: [],               // nest elements
            contexts: new Map(),            // context value
            keys: new Set(),                // keys
            listeners: new MapMap(),        // event listners
        };
    }

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

    get parent()
    {
        return this._.parent;
    }

    get element()
    {
        return this._.nestElements.slice(-1)[0] ?? this._.baseElement;
    }
    
    static nest(attributes)
    {
        const element = createElement(attributes, this.element);

        this.element.appendChild(element);
        this._.nestElements.push(element);
        return element;
    }

    static keys = new MapSet();
 
    set key(key)
    {
        if (isString(key) === false) {
            error('xnode key', 'The argument is invalid.', 'key');
        } else {
            this._.keys.forEach((key) => {
                XBase.keys.delete(key, this);
                this._.keys.delete(key);
            });
            key.trim().split(/\s+/).forEach((key) => {
                XBase.keys.add(key, this);
                this._.keys.add(key);
            });
        }
    }

    get key()
    {
        return [...this._.keys].join(' ');
    }

    static etypes = new MapSet();
  
    on(type, listener, options)
    {
        if (isString(type) === false) {
            error('xnode on', 'The argument is invalid.', 'type');
        } else if (isFunction(listener) === false) {
            error('xnode on', 'The argument is invalid.', 'listener');
        } else {
            type.trim().split(/\s+/).forEach((type) => internal.call(this, type, listener));
        }

        function internal(type, listener) {
            if (this._.listeners.has(type, listener) === false) {
                const element = this.element;
                const execute = (...args) => XBase.scope.call(this, listener, ...args);
                this._.listeners.set(type, listener, [element, execute]);
                element.addEventListener(type, execute, options);
            }
            if (this._.listeners.has(type) === true) {
                XBase.etypes.add(type, this);
            }
        }
    }

    off(type, listener)
    {
        if (type !== undefined && isString(type) === false) {
            error('xnode off', 'The argument is invalid.', 'type');
        } else if (listener !== undefined && isFunction(listener) === false) {
            error('xnode off', 'The argument is invalid.', 'listener');
        } else if (isString(type) === true && listener !== undefined) {
            type.trim().split(/\s+/).forEach((type) => internal.call(this, type, listener));
        } else if (isString(type) === true && listener === undefined) {
            type.trim().split(/\s+/).forEach((type) => {
                this._.listeners.get(type)?.forEach((_, listener) => internal.call(this, type, listener));
            });
        } else if (type === undefined) {
            this._.listeners.forEach((map, type) => {
                map.forEach((_, listener) => internal.call(this, type, listener));
            });
        }

        function internal(type, listener) {
            if (this._.listeners.has(type, listener) === true) {
                const [element, execute] = this._.listeners.get(type, listener);
                this._.listeners.delete(type, listener);
                element.removeEventListener(type, execute);
            }
            if (this._.listeners.has(type) === false) {
                XBase.etypes.delete(type, this);
            }
        }
    }

    emit(type, ...args)
    {
        if (isString(type) === false) {
            error('xnode emit', 'The argument is invalid.', 'type');
        } else if (this._.state === 'finalized') {
            error('xnode emit', 'This function can not be called after finalized.');
        } else {
            type.trim().split(/\s+/).forEach((type) => internal.call(this, type));
        }
        function internal(type) {
            if (type[0] === '~') {
                XBase.etypes.get(type)?.forEach((xnode) => {
                    xnode._.listeners.get(type)?.forEach(([element, execute]) => execute(...args));
                });
            } else {
                this._.listeners.get(type)?.forEach(([element, execute]) => execute(...args));
            }
        }
    }

    static context(key, value = undefined)
    {
        if (value !== undefined) {
            this._.contexts.set(key, value);
        } else {
            let ret = undefined;
            for (let target = this; target !== null; target = target.parent) {
                if (target._.contexts.has(key)) {
                    ret = target._.contexts.get(key);
                    break;
                }
            }
            return ret;
        }
    }

    static clear()
    {
        this.key = '';
        this.off();
        this._.contexts.clear();

        if (this._.nestElements.length > 0) {
            this._.baseElement.removeChild(this._.nestElements[0]);
            this._.nestElements = [];
        }
    }
}
