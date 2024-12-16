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

    //----------------------------------------------------------------------------------------------------
    // create element 
    //----------------------------------------------------------------------------------------------------

    function createElement(attributes)
    {
        const tagName = (attributes.tagName ?? 'div').toLowerCase();
        let element = null;
        if (tagName === 'svg') {
            element = document.createElementNS('http://www.w3.org/2000/svg', tagName);
        } else {
            element = document.createElement(tagName);
        }
        
        const bools = ['checked', 'disabled', 'readOnly',];

        Object.keys(attributes).forEach((key) => {
            const value = attributes[key];
            if (key === 'style') {
                if (isString(value) === true) {
                    element.style = value;
                } else if (isObject(value) === true){
                    Object.assign(element.style, value);
                }
            } else if (key === 'class') ; else if (key === 'className') {
                if (isString(value) === true) {
                    element.classList.add(...value.trim().split(/\s+/));
                }
            } else if (key === 'tagName') ; else if (bools.includes(key) === true) {
                element[key] = value;
            } else {
                element.setAttribute(key, value);
            }
        });

        return element;
    }

    //----------------------------------------------------------------------------------------------------
    // map set / map map
    //----------------------------------------------------------------------------------------------------

    class MapSet extends Map
    {
        has(key, value)
        {
            if (value === undefined) {
                return super.has(key) === true;
            } else {
                return super.has(key) === true && super.get(key).has(value) === true;
            }
        }

        add(key, value)
        {
            if (super.has(key) === false) {
                this.set(key, new Set());
            }
            this.get(key).add(value);
        }

        delete(key, value)
        {
            if (super.has(key) === false) return;

            this.get(key).delete(value);
            if (this.get(key).size === 0) {
                super.delete(key);
            }
        }
    }

    class MapMap extends Map
    {
        has(key, subkey)
        {
            if (subkey === undefined) {
                return super.has(key) === true;
            } else {
                return super.has(key) === true && super.get(key).has(subkey) === true;
            }
        }

        set(key, subkey, value)
        {
            if (super.has(key) === false) {
                super.set(key, new Map());
            }
            super.get(key).set(subkey, value);
        }

        get(key, subkey)
        {
            if (subkey === undefined) {
                return super.get(key);
            } else {
                return super.get(key).get(subkey);
            }
        }

        delete(key, subkey)
        {
            if (super.has(key) === false) return;

            super.get(key).delete(subkey);
            if (super.get(key).size === 0) {
                super.delete(key);
            }
        }
    }

    //----------------------------------------------------------------------------------------------------
    // timer
    //----------------------------------------------------------------------------------------------------

    class Timer
    {
        constructor(callback, delay, loop)
        {
            this.callback = callback;
            this.delay = delay;
            this.loop = loop;

            this.id = null;
            this.time = null;
            this.offset = 0.0;
        }

        clear()
        {
            if (this.id === null) {
                clearTimeout(this.id);
                this.id = null;
            }
        }

        static start()
        {
            if (this.id === null) {
                this.id = setTimeout(() => {
                    this.callback();

                    this.id = null;
                    this.time = null;
                    this.offset = 0.0;
        
                    if (this.loop) {
                        Timer.start.call(this);
                    }
                }, this.delay - this.offset);
                this.time = Date.now();
            }
        }

        static stop()
        {
            if (this.id !== null) {
                this.offset = Date.now() - this.time + this.offset;
                clearTimeout(this.id);

                this.id = null;
                this.time = null;
            }
        }
    }


    //----------------------------------------------------------------------------------------------------
    // error 
    //----------------------------------------------------------------------------------------------------

    function error(name, text, target = undefined) {
        console.error(name + (target !== undefined ? ` [${target}]` : '') + ': ' + text);
    }

    class XBase
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
                contexts: new Map(),            // context value
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
            this._.contexts.clear();
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

        static context(key, value = undefined)
        {
            if (value !== undefined) {
                this._.contexts.set(key, value);
            } else {
                for (let xnode = this; xnode instanceof XBase; xnode = xnode.parent) {
                    if (xnode._.contexts.has(key)) {
                        return xnode._.contexts.get(key);
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
            if (type[0] === '~') {
                XBase.etypes.get(type)?.forEach((xnode) => {
                    xnode._.listeners.get(type)?.forEach(([element, execute]) => execute(...args));
                });
            } else {
                this._.listeners.get(type)?.forEach(([element, execute]) => execute(...args));
            }
        }
    }

    class XNode extends XBase
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
                    XNode.start.call(xnode, time);
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
                components: new Set(),          // components functions
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

        static components = new MapSet();

        static extend(component, ...args)
        {
            if (this._.components.has(component) === false) {
                this._.components.add(component);
                XNode.components.add(component, this);

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
                            if (previous !== undefined) {
                                this._.props[key] = (...args) => { previous(...args); descripter.value(...args); };
                            } else {
                                this._.props[key] = (...args) => { descripter.value(...args); };
                            }
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
                return original;
            }
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

                this._.components.forEach((component) => {
                    XNode.components.delete(component, this);
                });
                
                XBase.clear.call(this);
            }
        }
    }

    XNode.reset();

    function xnew(...args)
    {
        // parent xnode
        let parent = undefined;
        if (args[0] instanceof XNode) {
            parent = args.shift();
        } else if (args[0] === null) {
            parent = args.shift();
        } else if (args[0] === undefined) {
            parent = args.shift();
            parent = XNode.current;
        } else {
            parent = XNode.current;
        }

        // input element
        let element = undefined;
        if (args[0] instanceof Element || args[0] instanceof Window || args[0] instanceof Document) {
            // an existing html element
            element = args.shift();
        } else if (isString(args[0]) === true) {
            // a string for an existing html element
            element = document.querySelector(args.shift());
        } else if (isObject(args[0]) === true) {
            // an attributes for a new html element
            element = args.shift();
        } else if (args[0] === null || args[0] === undefined) {
            element = args.shift();
            element = null;
        } else {
            element = undefined;
        }

        if (args.length > 0) {
            const component = args[0];

            if (isObject(element) === false && isString(component) === true) {
                error('xnew', 'The argument is invalid.', 'component');
                return;
            }
        }

        return new XNode(parent, element, ...args);
    }

    function xcontext(key, value)
    {
        const xnode = XNode.current;

        if (isString(key) === false) {
            error('xcontext', 'The argument is invalid.', 'key');
        } else {
            return XNode.context.call(xnode, key, value);
        }
    }

    function xfind(key)
    {
        if (isString(key) === false && isFunction(key) === false) {
            error('xfind', 'The argument is invalid.', 'key');
        } else if (isString(key) === true) {
            const set = new Set();
            key.trim().split(/\s+/).forEach((key) => {
                XNode.keys.get(key)?.forEach((xnode) => set.add(xnode));
            });
            return [...set];
        } else if (isFunction(key) === true) {
            const set = new Set();
            XNode.components.get(key)?.forEach((xnode) => set.add(xnode));
            return [...set];
        }
    }

    function xtimer(callback, delay = 0, loop = false)
    {
        const current = XNode.current;

        const timer = new Timer(() => {
            XNode.scope.call(current, callback);
        }, delay, loop);

        if (document !== undefined) {
            if (document.hidden === false) {
                Timer.start.call(timer);
            }
            const xdoc = xnew(document);
            xdoc.on('visibilitychange', (event) => {
                document.hidden === false ? Timer.start.call(timer) : Timer.stop.call(timer);
            });
        } else {
            Timer.start.call(timer);
        }

        xnew(() => {
            return {
                finalize() {
                    timer.clear();
                }
            }
        });
        return timer;
    }

    function DragEvent(xnode) {
        let isActive = false;
      
        const base = xnew();

        base.on('pointerdown', (event) => {
            const id = event.pointerId;
            const rect = xnode.element.getBoundingClientRect();
            const position = getPosition(event, rect);
           
            xnode.emit('down', event, { type: 'down', position });
            let previous = position;
            isActive = true;

            const xwin = xnew(window);

            xwin.on('pointermove', (event) => {
                if (event.pointerId === id) {
                    const position = getPosition(event, rect);
                    const delta = { x: position.x - previous.x, y: position.y - previous.y };
                    
                    xnode.emit('move', event, { type: 'move', position, delta });
                    previous = position;
                }
            });

            xwin.on('pointerup', (event) => {
                if (event.pointerId === id) {
                    const position = getPosition(event, rect);
                    xnode.emit('up', event, { type: 'up', position, });
                    xwin.finalize();
                    isActive = false;
                }
            });

            xwin.on('pointercancel', (event) => {
                if (event.pointerId === id) {
                    const position = getPosition(event, rect);
                    xnode.emit('cancel', event, { type: 'cancel', position, });
                    xwin.finalize();
                    isActive = false;
                }
            });
        });

        function getPosition(event, rect) {
            return { x: event.clientX - rect.left, y: event.clientY - rect.top };
        }

        return {
            get isActive() {
                return isActive;
            },
        }
    }

    function GestureEvent(xnode) {
        const drag = xnew(DragEvent);

        let isActive = false;
        const map = new Map();

        drag.on('down', (event, { position }) => {
            const id = event.pointerId;
            map.set(id, { ...position });
          
            isActive = map.size === 2 ? true : false;
            if (isActive === true) {
                xnode.emit('down', event, { type: 'down', });
            }
        });

        drag.on('move', (event, { position, delta }) => {
            const id = event.pointerId;
            if (isActive === true) {
                const a = map.get(id);
                map.delete(id);
                const b = [...map.values()][0]; 

                const v = { x: a.x - b.x, y: a.y - b.y };
                const s =  v.x * v.x + v.y * v.y;
                const scale = 1 + (s > 0.0 ? (v.x * delta.x + v.y * delta.y) / s : 0);
                xnode.emit('move', event, { type: 'move', scale, });
            }
            map.set(id, { ...position });
        });

        drag.on('up cancel', (event, { type }) => {
            const id = event.pointerId;
            if (isActive === true) {
                xnode.emit(type, event, { type, });
            }
            isActive = false;
            map.delete(id);
        });

        return {
            get isActive() {
                return isActive;
            },
        }
    }

    function ResizeEvent(xnode) {

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                xnode.emit('resize');
                break;
            }
        });

        if (xnode.element) {
            observer.observe(xnode.element);
        }
        return {
            finalize() {
                if (xnode.element) {
                    observer.unobserve(xnode.element);
                }
            }
        }
    }

    function Screen(xnode, { width = 640, height = 480, objectFit = 'contain', pixelated = false } = {}) {
        const wrapper = xnode.nest({ style: 'position: relative; width: 100%; height: 100%; overflow: hidden; user-select: none;' });
        const absolute = xnode.nest({ style: 'position: absolute; inset: 0; margin: auto; user-select: none;' });
        xnode.nest({ style: 'position: relative; width: 100%; height: 100%; user-select: none;' });

        const size = { width, height };
        const canvas = xnew({ tagName: 'canvas', width, height, style: 'position: absolute; width: 100%; height: 100%; vertical-align: bottom; user-select: none;' });
        
        if (pixelated === true) {
            canvas.element.style.imageRendering = 'pixelated';
        }
        
        objectFit = ['fill', 'contain', 'cover'].includes(objectFit) ? objectFit : 'contain';
      
        const observer = xnew(wrapper, ResizeEvent);
        observer.on('resize', resize);
        resize();

        function resize() {
            const aspect = size.width / size.height;
           
            let style = { width: '100%', height: '100%', top: '0', left: '0', bottom: '0', right: '0' };
            if (objectFit === 'fill') ; else if (objectFit === 'contain') {
                if (wrapper.clientWidth < wrapper.clientHeight * aspect) {
                    style.height = Math.floor(wrapper.clientWidth / aspect) + 'px';
                } else {
                    style.width = Math.floor(wrapper.clientHeight * aspect) + 'px';
                }
            } else if (objectFit === 'cover') {
                if (wrapper.clientWidth < wrapper.clientHeight * aspect) {
                    style.width = Math.floor(wrapper.clientHeight * aspect) + 'px';
                    style.left = Math.floor((wrapper.clientWidth - wrapper.clientHeight * aspect) / 2) + 'px';
                    style.right = 'auto';
                } else {
                    style.height = Math.floor(wrapper.clientWidth / aspect) + 'px';
                    style.top = Math.floor((wrapper.clientHeight - wrapper.clientWidth / aspect) / 2) + 'px';
                    style.bottom = 'auto';
                }
            }
            Object.assign(absolute.style, style);
        }

        return {
            get width() {
                return size.width;
            },
            get height() {
                return size.height;
            },
            get canvas() {
                return canvas.element;
            },
            resize(width, height) {
                size.width = width;
                size.height = height;
                canvas.element.width = width;
                canvas.element.height = height;
                resize();
            },
            clear(color = null) {
                const ctx = canvas.element.getContext('2d');
                ctx.clearRect(0, 0, size.width, size.height);
                if (typeof color === 'string') {
                    ctx.fillStyle = color;
                    ctx.fillRect(0, 0, size.width, size.height);  
                }
            },
        }
    }

    function SubWindow(xnode) {
        const absolute = xnode.nest({ style: 'position: absolute;' });
        
        return {
            setPosition(x, y) {
                absolute.style.left = x + 'px';
                absolute.style.top = y + 'px';
            },
            getPosition() {
                return { x: absolute.offsetLeft, y: absolute.offsetTop };
            },
        }
    }

    const xbasics = {
        DragEvent,
        GestureEvent,
        ResizeEvent,
        Screen,
        SubWindow
    };

    exports.xbasics = xbasics;
    exports.xcontext = xcontext;
    exports.xfind = xfind;
    exports.xnew = xnew;
    exports.xtimer = xtimer;

}));
