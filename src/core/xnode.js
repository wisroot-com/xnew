import { isString, isNumber, isObject, isFunction, createElement, Timer, error } from './util';
import { XBase } from './xbase';

export class XNode extends XBase {

    constructor(parent, element, component, ...args)
    {
        super(parent, element, component);

        (parent?._.children ?? XNode.roots).add(this);
        XNode.initialize.call(this, parent, element, component, ...args);
    }

    get element()
    {
        return this._.nest;
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

    //----------------------------------------------------------------------------------------------------
    // auxiliary
    //----------------------------------------------------------------------------------------------------        
    
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
        } else {
            this._.nest = this._.nest.appendChild(createElement(attributes));
            return this.element;
        }
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

    on(type, listener, options)
    {
        if (isString(type) === false) {
            error('xnode on', 'The argument is invalid.', 'type');
        } else if (isFunction(listener) === false) {
            error('xnode on', 'The argument is invalid.', 'listener');
        } else {
            type.trim().split(/\s+/).forEach((type) => XNode.on.call(this, type, listener, options));
        }
    }

    off(type, listener)
    {
        if (type !== undefined && isString(type) === false) {
            error('xnode off', 'The argument is invalid.', 'type');
        } else if (listener !== undefined && isFunction(listener) === false) {
            error('xnode off', 'The argument is invalid.', 'listener');
        } else if (isString(type) === true) {
            type.trim().split(/\s+/).forEach((type) => XNode.off.call(this, type, listener));
        } else if (type === undefined) {
            [...this._.listeners.keys()].forEach((type) => XNode.off.call(this, type, listener));
        }
    }

    emit(type, ...args)
    {
        if (isString(type) === false) {
            error('xnode emit', 'The argument is invalid.', 'type');
        } else if (this._.state === 'finalized') {
            error('xnode emit', 'This function can not be called after finalized.');
        } else {
            type.trim().split(/\s+/).forEach((type) => XNode.emit.call(this, type, ...args));
        }
    }

    timer(callback, delay = 0, loop = false)
    {
        const current = this;

        function execute() {
            XBase.scope.call(current, callback);
        }
        const timer = new Timer(execute, delay, loop);

        if (document === undefined || document.hidden === false) {
            Timer.start.call(timer);
        }

        // manager
        if (document !== undefined) {
            const xdoc = new XNode(current, document);
            xdoc.on('visibilitychange', (event) => {
                document.hidden === false ? Timer.start.call(timer) : Timer.stop.call(timer);
            });
        }

        new XNode(current, current.element, () => {
            return {
                finalize() {
                    timer.clear();
                }
            }
        });

        return timer;
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
            XNode.roots.forEach((xnode) => XNode.update.call(xnode, time));
            XNode.animation = requestAnimationFrame(ticker);
        }
    }

    static initialize(parent, element, component, ...args)
    {
        this._ = Object.assign(this._, {
            children: new Set(),            // children xnodes
            nest: this._.base,              // nest element
            state: 'pending',               // [pending -> running <-> stopped -> finalized]
            tostart: false,                 // flag for start
            promises: [],                   // promises
            resolve: false,                 // promise check
            start: null,                    // start time
            props: {},                      // properties in the component function
            components: new Set(),          // component functions
            listeners: new Map(),           // event listners
        });

        if (parent !== null && ['finalized'].includes(parent._.state)) {
            this._.state = 'finalized';
        } else {
            this._.tostart = true;

            // nest html element
            if (isObject(element) === true) {
                this._.nest = this._.nest.appendChild(createElement(element));
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
        if (this._.components.has(component) === false) {
            this._.components.add(component);
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
            const { promise, start, update, stop, finalize, ...others } = props;
            return others;
        }
    }

    static start(time) {
        if (['pending', 'stopped'].includes(this._.state) && this._.resolve === true && this._.tostart === true) {
            if (this._.parent === null || ['running'].includes(this._.parent.state)) {
                this._.start = time;
                this._.state = 'running';
                this._.children.forEach((xnode) => XNode.start.call(xnode, time));
            
                if (this._.state === 'running' && isFunction(this._.props.start) === true) {
                    XBase.scope.call(this, this._.props.start);
                }
            }
        }
    }

    static stop() {
        if (['running'].includes(this._.state)) {
            this._.state = 'stopped';
            this._.children.forEach((xnode) => XNode.stop.call(xnode));

            if (this._.state === 'stopped' && isFunction(this._.props.stop)) {
                XBase.scope.call(this, this._.props.stop);
            }
        }
    }

    static update(time) {
        if (['pending', 'running', 'stopped'].includes(this._.state)) {
            if (this._.tostart === true) XNode.start.call(this, time);

            this._.children.forEach((xnode) => XNode.update.call(xnode, time));

            if (this._.state === 'running' && isFunction(this._.props.update) === true) {
                // time: elapsed time from start
                const e = time - this._.start;
                XBase.scope.call(this, this._.props.update);
            }
        }
    }

    static finalize() {
        if (['pending', 'stopped'].includes(this._.state)) {
            this._.state = 'finalized';
            
            [...this._.children].forEach((xnode) => xnode.finalize());
            
            if (isFunction(this._.props.finalize)) {
                XBase.scope.call(this, this._.props.finalize);
            }
    
            XBase.clear.call(this);
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
    }

    static etypes = new Map();
  
    static on(type, listener, options)
    {
        if (this._.listeners.has(type) === false) {
            this._.listeners.set(type, new Map());
        }

        if (this._.listeners.get(type).has(listener) === false) {
            const scope = (...args) => XBase.scope.call(this, listener, ...args);

            this._.listeners.get(type).set(listener, [this._.nest, scope]);
            this._.nest.addEventListener(type, scope, options);
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
                const [element, scope] = this._.listeners.get(type).get(listener);
    
                this._.listeners.get(type).delete(listener);
                if (this._.listeners.get(type).size === 0) this._.listeners.delete(type);
    
                element.removeEventListener(type, scope);
            }
            if (this._.listeners.has(type) === false && XNode.etypes.has(type) === true) {
                XNode.etypes.get(type).delete(this);
                if (XNode.etypes.get(type).size === 0) XNode.etypes.delete(type);
            }
        });
    }

    static emit(type, ...args) {
        let token = null;
        if (['+'].includes(type[0])) {
            token = type[0];
            type = type.substring(1);
        }
        if (XNode.etypes.has(type)) {
            if (token !== null) {
                const root = this._.root;
                XNode.etypes.get(type).forEach((xnode) => {
                    if (xnode._.root === root) {
                        emit.call(xnode, type, ...args);
                    }
                });
            } else {
                emit.call(this, type, ...args);
            }
        }
        function emit(type, ...args) {
            if (this._.listeners.has(type) === true) {
                this._.listeners.get(type).forEach(([element, listener]) => listener(...args));
            }
        }
    }

}

XNode.reset();
