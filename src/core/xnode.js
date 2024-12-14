import { isString, isNumber, isObject, isFunction, error } from './util';
import { XBase } from './xbase';

export class XNode extends XBase
{
    constructor(parent, element, component, ...args)
    {
        super(parent, element);

        (parent?._.children ?? XNode.roots).add(this);
        XNode.initialize.call(this, parent, element, component, ...args);
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

    extend(component, ...args)
    {
        if (isFunction(component) === false) {
            error('xnode extend', 'The argument is invalid.', 'component');
        } else if (this._.state !== 'pending') {
            error('xnode extend', 'This function can not be called after initialized.');
        } else {
            return XNode.extend.call(this, component, ...args);
        }
    }

    //----------------------------------------------------------------------------------------------------
    // internal
    //----------------------------------------------------------------------------------------------------
    
    // animation callback id
    static animation = null;
    
    static reset()
    {
        XNode.roots.forEach((xnode) => xnode.finalize());
        XNode.roots.clear();

        if (XNode.animation) {
            cancelAnimationFrame(XNode.animation);
        }
        XNode.animation = requestAnimationFrame(ticker);
        function ticker() {
            const time = Date.now();
            XNode.roots.forEach((xnode) => {
                XNode.start.call(xnode);
                XNode.update.call(xnode, time);
            });
            XNode.animation = requestAnimationFrame(ticker);
        }
    }

    static initialize(parent, element, component, ...args)
    {
        this._ = Object.assign(this._, {
            backup: [parent, element, component],

            children: new Set(),            // children xnodes
            state: 'pending',               // [pending -> running <-> stopped -> finalized]
            tostart: false,                 // flag for start
            promises: [],                   // promises
            resolve: false,                 // promise check
            props: {},                      // properties in the component function
        });

        if (parent !== null && ['finalized'].includes(parent._.state)) {
            this._.state = 'finalized';
        } else {
            this._.tostart = true;

            // nest html element
            if (isObject(element) === true) {
                this.nest(element);
            }

            // setup component
            if (isFunction(component) === true) {
                XNode.extend.call(this, component, ...args);
            } else if (isObject(element) === true && isString(component) === true) {
                this.element.innerHTML = component;
            }

            // whether the xnode promise was resolved
            this.promise.then((response) => { this._.resolve = true; return response; });
        }
    }

    static extend(component, ...args)
    {
        const props = XBase.scope.call(this, component, this, ...args) ?? {};
        
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
                    this._.props[key] = previous ? (...args) => { previous(...args); descripter.value(...args); } : descripter.value;
                } else {
                    error('xnode extend', 'The property is invalid.', key);
                }
            } else {
                if (this._.props[key] !== undefined || this[key] === undefined) {
                    const dest = { configurable: true, enumerable: true };

                    if (isFunction(descripter.value) === true) {
                        dest.value = (...args) => XBase.scope.call(this, descripter.value, ...args);
                    } else if (descripter.value !== undefined) {
                        dest.value = descripter.value;
                    }
                    if (isFunction(descripter.get) === true) {
                        dest.get = (...args) => XBase.scope.call(this, descripter.get, ...args);
                    }
                    if (isFunction(descripter.set) === true) {
                        dest.set = (...args) => XBase.scope.call(this, descripter.set, ...args);
                    }

                    Object.defineProperty(this._.props, key, dest);
                    Object.defineProperty(this, key, dest);
                } else {
                    error('xnode extend', 'The property already exists.', key);
                }
            }
        });
        const { promise, start, update, stop, finalize, ...original } = props;
        return props;
    }

    static start(time) {
        if (this._.resolve === false || this._.tostart === false) return;

        if (['pending', 'stopped'].includes(this._.state) === true) {
            this._.state = 'running';
            this._.children.forEach((xnode) => XNode.start.call(xnode, time));

            if (isFunction(this._.props.start) === true) {
                XBase.scope.call(this, this._.props.start);
            }
        } else if (['running'].includes(this._.state) === true) {
            this._.children.forEach((xnode) => XNode.start.call(xnode, time));
        }
    }

    static stop() {
        if (['running'].includes(this._.state) === true) {
            this._.state = 'stopped';
            this._.children.forEach((xnode) => XNode.stop.call(xnode));

            if (isFunction(this._.props.stop)) {
                XBase.scope.call(this, this._.props.stop);
            }
        }
    }

    static update(time) {
        if (['running'].includes(this._.state) === true) {
            this._.children.forEach((xnode) => XNode.update.call(xnode, time));

            if (['running'].includes(this._.state) && isFunction(this._.props.update) === true) {
                XBase.scope.call(this, this._.props.update);
            }
        }
    }

    static finalize() {
        if (['finalized'].includes(this._.state) === false) {
            this._.state = 'finalized';
            
            [...this._.children].forEach((xnode) => xnode.finalize());
            
            if (isFunction(this._.props.finalize)) {
                XBase.scope.call(this, this._.props.finalize);
            }
    
            // reset props
            Object.keys(this._.props).forEach((key) => {
                if (['promise', 'start', 'update', 'stop', 'finalize'].includes(key)) {
                    delete this._.props[key];
                } else {
                    delete this._.props[key];
                    delete this[key];
                }
            });

            XBase.clear.call(this);
        }
    }
}

XNode.reset();
