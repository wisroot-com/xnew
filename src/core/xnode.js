import { isString, isNumber, isObject, isFunction, MapSet, error } from './util';
import { XBase } from './xbase';

export class XNode extends XBase
{
    constructor(parent, element, component, ...args)
    {
        super(parent, element);

        (parent?._.children ?? XNode.roots).add(this);
        XNode.initialize.call(this, parent, element, component, ...args);
    }

    static roots = new Set();   // root xnodes
    static animation = null;    // animation callback id
    
    static reset()
    {
        XNode.roots.forEach((xnode) => xnode.finalize());
        XNode.roots.clear();

        if (XNode.animation !== null) {
            cancelAnimationFrame(XNode.animation);
            XNode.animation = null;
        }
        XNode.animation = requestAnimationFrame(function ticker() {
            const time = Date.now();
            XNode.roots.forEach((xnode) => XNode.ticker.call(xnode, time));
            XNode.animation = requestAnimationFrame(ticker);
        });
    }

    static initialize(parent, element, component, ...args)
    {
        this._ = Object.assign(this._, {
            backup: [parent, element, component],
            children: new Set(),            // children xnodes
            state: 'pending',               // [pending -> running <-> stopped -> finalized]
            tostart: false,                 // flag for start
            promises: [],                   // promises
            resolved: false,                // promise check
            components: new Set(),          // components functions
            props: {},                      // properties in the component function
        });

        if (parent !== null && ['finalized'].includes(parent._.state)) {
            this._.state = 'finalized';
        } else {
            this._.tostart = true;

            // nest html element
            if (isObject(element) === true && this.element instanceof Element) {
                XNode.nest.call(this, element);
            }

            // setup component
            if (isFunction(component) === true) {
                XNode.extend.call(this, component, ...args);
            } else if (isObject(element) === true && isString(component) === true) {
                this.element.innerHTML = component;
            }

            // whether the xnode promise was resolved
            this.promise.then((response) => { this._.resolved = true; return response; });
        }
    }

    static components = new MapSet();

    static extend(component, ...args)
    {
        this._.components.add(component);
        XNode.components.add(component, this);

        const props = XNode.scope.call(this, component, ...args) ?? {};
        
        Object.keys(props).forEach((key) => {
            const descripter = Object.getOwnPropertyDescriptor(props, key);

            if (key === 'promise') {
                if (descripter.value instanceof Promise) {
                    this._.promises.push(descripter.value);
                } else {
                    error('xnode extend', 'The property is invalid.', key);
                }
            } else if (['start', 'update', 'stop', 'finalize'].includes(key)) {
                if (isFunction(descripter.value)) {
                    const previous = this._.props[key];
                    if (previous !== undefined) {
                        this._.props[key] = (...args) => { previous(...args); descripter.value(...args); };
                    } else {
                        this._.props[key] = (...args) => { descripter.value(...args); };
                    }
                } else {
                    error('xnode extend', 'The property is invalid.', key);
                }
            } else if (this._.props[key] !== undefined || this[key] === undefined) {
                const dest = { configurable: true, enumerable: true };

                if (isFunction(descripter.value) === true) {
                    dest.value = (...args) => XNode.scope.call(this, descripter.value, ...args);
                } else if (descripter.value !== undefined) {
                    dest.value = descripter.value;
                }
                if (isFunction(descripter.get) === true) {
                    dest.get = (...args) => XNode.scope.call(this, descripter.get, ...args);
                }
                if (isFunction(descripter.set) === true) {
                    dest.set = (...args) => XNode.scope.call(this, descripter.set, ...args);
                }
                Object.defineProperty(this._.props, key, dest);
                Object.defineProperty(this, key, dest);
            } else {
                error('xnode extend', 'The property already exists.', key);
            }
        });
        const { promise, start, update, stop, finalize, ...original } = props;
        return original;
    }

    get promise()
    {
        return this._.promises.length > 0 ? Promise.all(this._.promises) : Promise.resolve();
    }

    get state()
    {
        return this._.state
    }

    start()
    {
        this._.tostart = true;
    }

    stop()
    {
        this._.tostart = false;
        XNode.stop.call(this);
    }

    finalize()
    {
        XNode.stop.call(this);
        XNode.finalize.call(this);

        (this._.parent?._.children ?? XNode.roots).delete(this);
    }

    reboot(...args)
    {
        XNode.stop.call(this);
        XNode.finalize.call(this);
        
        (this._.parent?._.children ?? XNode.roots).add(this);
        XNode.initialize.call(this, ...this._.backup, ...args);
    }

    static ticker(time)
    {
        XNode.start.call(this, time);
        XNode.update.call(this, time);
    }
    
    static start(time)
    {
        if (this._.resolved === false || this._.tostart === false) {
        } else if (['pending', 'stopped'].includes(this._.state) === true) {
            this._.state = 'running';
            this._.children.forEach((xnode) => XNode.start.call(xnode, time));

            if (isFunction(this._.props.start) === true) {
                XNode.scope.call(this, this._.props.start);
            }
        } else if (['running'].includes(this._.state) === true) {
            this._.children.forEach((xnode) => XNode.start.call(xnode, time));
        }
    }

    static stop()
    {
        if (['running'].includes(this._.state) === true) {
            this._.state = 'stopped';
            this._.children.forEach((xnode) => XNode.stop.call(xnode));

            if (isFunction(this._.props.stop)) {
                XNode.scope.call(this, this._.props.stop);
            }
        }
    }

    static update(time)
    {
        if (['running'].includes(this._.state) === true) {
            this._.children.forEach((xnode) => XNode.update.call(xnode, time));

            if (['running'].includes(this._.state) && isFunction(this._.props.update) === true) {
                XNode.scope.call(this, this._.props.update);
            }
        }
    }

    static finalize()
    {
        if (['finalized'].includes(this._.state) === false) {
            this._.state = 'finalized';
            
            [...this._.children].forEach((xnode) => xnode.finalize());
            
            if (isFunction(this._.props.finalize)) {
                XNode.scope.call(this, this._.props.finalize);
            }
    
            this._.components.forEach((component) => {
                XNode.components.delete(component, this);
            });
            this._.components.clear();
            
            // reset props
            Object.keys(this._.props).forEach((key) => {
                if (['promise', 'start', 'update', 'stop', 'finalize'].includes(key) === false) {
                    delete this[key];
                }
            });
            this._.props = {};

            XBase.clear.call(this);
        }
    }
}

XNode.reset();
