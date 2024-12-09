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
    // error 
    //----------------------------------------------------------------------------------------------------

    function error(name, text, target = undefined) {
        console.error(name + (target !== undefined ? ` [${target}]` : '') + ': ' + text);
    }

    class XNode {

        //----------------------------------------------------------------------------------------------------
        // basic
        //----------------------------------------------------------------------------------------------------
        
        constructor(parent, element, component, ...args)
        {
            XNode.initialize.call(this, parent, element, component, ...args);
        }

        get parent()
        {
            return this._.parent;
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
        }

        reset(...args)
        {
            XNode.stop.call(this);
            XNode.finalize.call(this);
            XNode.initialize.call(this, ...this._.backup, ...args);
        }

        //----------------------------------------------------------------------------------------------------
        // auxiliary
        //----------------------------------------------------------------------------------------------------        

        set key(key)
        {
            if (isString(key) === false) {
                error('xnode key', 'The argument is invalid.', 'key');
            } else {
                XNode.setkey.call(this, key);
            }
        }

        get key()
        {
            return XNode.getkey.call(this);
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


        //----------------------------------------------------------------------------------------------------
        // internal
        //----------------------------------------------------------------------------------------------------
        
        // root xnodes
        static roots = new Set();

        // animation callback id
        static animation = null;

        // current xnode scope
        static current = null;

        static boot()
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
            (parent?._.children ?? XNode.roots).add(this);

            const root = parent?._.root ?? this;
            const base = (element instanceof Element || element instanceof Window) ? element : (parent?._.nest ?? document?.body ?? null);

            this._ = {
                backup: [parent, element, component],
              
                root,                           // root xnode
                parent,                         // parent xnode
                children: new Set(),            // children xnodes
                base,                           // base element
                nest: base,                     // nest element

                state: 'pending',               // [pending -> running <-> stopped -> finalized]
                tostart: false,                 // flag for start
                promises: [],                   // promises
                resolve: false,                 // promise check
                start: null,                    // start time
                props: {},                      // properties in the component function
                components: new Set(),          // component functions
                listeners: new Map(),           // event listners
                context: new Map(),             // context value
                keys: new Set(),                // keys
            };

            if (parent !== null && ['finalized'].includes(parent._.state)) {
                this._.state = 'finalized';
            } else {
                this._.tostart = true;

                // nest html element
                if (isObject(element) === true) {
                    XNode.nest.call(this, element);
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

        static scope(func, ...args)
        {
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

        static nest(attributes)
        {
            const { tagName, ...others } = attributes;
            const element = tagName?.toLowerCase() === 'svg' ? 
                document.createElementNS('http://www.w3.org/2000/svg', tagName) : 
                document.createElement(tagName ?? 'div');
            
            const bools = ['checked', 'disabled', 'readOnly',];
        
            Object.keys(others).forEach((key) => {
                const value = others[key];
                if (key === 'style') {
                    if (isString(value) === true) {
                        element.style = value;
                    } else if (isObject(value) === true){
                        Object.assign(element.style, value);
                    }
                } else if (key === 'className') {
                    if (isString(value) === true) {
                        element.classList.add(...value.trim().split(/\s+/));
                    }
                } else if (key === 'class') ; else if (bools.includes(key) === true) {
                    element[key] = value;
                } else {
                    element.setAttribute(key, value);
                }
            });
        
            this._.nest = this._.nest.appendChild(element);
        }

        static extend(component, ...args)
        {
            if (this._.components.has(component) === false) {
                this._.components.add(component);
                const props = XNode.scope.call(this, component, this, ...args) ?? {};
                
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
                        XNode.scope.call(this, this._.props.start);
                    }
                }
            }
        }

        static stop() {
            if (['running'].includes(this._.state)) {
                this._.state = 'stopped';
                this._.children.forEach((xnode) => XNode.stop.call(xnode));

                if (this._.state === 'stopped' && isFunction(this._.props.stop)) {
                    XNode.scope.call(this, this._.props.stop);
                }
            }
        }

        static update(time) {
            if (['pending', 'running', 'stopped'].includes(this._.state)) {
                if (this._.tostart === true) XNode.start.call(this, time);

                this._.children.forEach((xnode) => XNode.update.call(xnode, time));

                if (this._.state === 'running' && isFunction(this._.props.update) === true) {
                    // time: elapsed time from start
                    time - this._.start;
                    XNode.scope.call(this, this._.props.update);
                }
            }
        }

        static finalize() {
            if (['pending', 'stopped'].includes(this._.state)) {
                this._.state = 'finalized';
                
                [...this._.children].forEach((xnode) => xnode.finalize());
                
                if (isFunction(this._.props.finalize)) {
                    XNode.scope.call(this, this._.props.finalize);
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

        static keys = new Map();
        
        static setkey(key)
        {
            // clear all
            this._.keys.forEach((key) => {
                XNode.keys.get(key).delete(this);
                if (XNode.keys.get(key).size === 0) {
                    XNode.keys.delete(key);
                }
                this._.keys.delete(key);
            });

            key.trim().split(/\s+/).forEach((key) => {
                if (XNode.keys.has(key) === false) {
                    XNode.keys.set(key, new Set());
                }
                XNode.keys.get(key).add(this);
                this._.keys.add(key);
            });
        }

        static getkey()
        {
            return [...this._.keys].join(' ');
        }

        static etypes = new Map();
      
        static on(type, listener, options)
        {
            if (this._.listeners.has(type) === false) {
                this._.listeners.set(type, new Map());
            }

            if (this._.listeners.get(type).has(listener) === false) {
                const scope = (...args) => XNode.scope.call(this, listener, ...args);

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
                    this._.listeners.get(type).forEach(([element, listener]) => listener(...args));
                }
            }
        }

        static context(name, value = undefined) {
            const ret = (() => {
                for (let xnode = this; xnode instanceof XNode; xnode = xnode.parent) {
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

    XNode.boot();

    function xnew(...args)
    {
        // parent xnode
        let parent = undefined;
        if (args[0] instanceof XNode || args[0] === null || args[0] === undefined) {
            parent = args.shift();
        }
        parent = (parent instanceof XNode || parent === null) ? parent : XNode.current;

        // base element
        let element = undefined;
        if (args[0] instanceof Element || args[0] === window || isObject(args[0]) || args[0] === null || args[0] === undefined) {
            element = args.shift();
        }

        if (isObject(element) === false && args.length > 0 && isFunction(args[0]) === false && isString(args[0]) === false) {
            error('xnew', 'The argument is invalid.', 'component');
        } else {
            return new XNode(parent, element, ...args);
        }
    }

    function xnest(attributes)
    {
        const xnode = XNode.current;

        if (xnode === null) {
            error('xnest', 'This function can not be called outside a component function.');
        } else if (xnode.element instanceof Window) {
            error('xnest', 'No elements are added to window.');
        } else if (isObject(attributes) === false) {
            error('xnest', 'The argument is invalid.', 'attributes');
        } else if (xnode._.state !== 'pending') {
            error('xnest', 'This function can not be called after initialized.');
        } else {
            XNode.nest.call(xnode, attributes);
            return xnode.element;
        }
    }

    function xextend(component, ...args)
    {
        const xnode = XNode.current;

        if (xnode === null) {
            error('xextend', 'This function can not be called outside a component function.');
        } else if (isFunction(component) === false) {
            error('xextend', 'The argument is invalid.', 'component');
        } else if (xnode._.state !== 'pending') {
            error('xextend', 'This function can not be called after initialized.');
        } else {
            return XNode.extend.call(xnode, component, ...args);
        }
    }

    function xcontext(name, value)
    {
        const xnode = XNode.current;

        if (isString(name) === false) {
            error('xcontext', 'The argument is invalid.', 'name');
        } else {
            return XNode.context.call(xnode, name, value);
        }
    }

    function xfind(key)
    {
        if (isString(key) === false) {
            error('xfind', 'The argument is invalid.', 'key');
        } else {
            const set = new Set();
            key.trim().split(/\s+/).forEach((key) => {
                XNode.keys.get(key)?.forEach((xnode) => set.add(xnode));
            });
            return [...set];
        }
    }

    function PointerEvent(xnode) {
        const base = xnew();

        const map = new Map();
        
        base.on('pointerdown', (event) => {
            const id = event.pointerId;
            const rect = xnode.element.getBoundingClientRect();
            const position = getPosition(event, rect);

            map.set(id, { ...position });
            xnode.emit('down', event, { type: 'down', position });

            const xwin = xnew(window);
            xwin.on('pointermove', (event) => {
                const position = getPosition(event, rect);
                const previous = map.get(id);
                map.delete(id);
                const delta = { x: position.x - previous.x, y: position.y - previous.y };

                map.set(id, { ...position });
                xnode.emit('dragmove', event, { type: 'dragmove', position, delta });
            });

            xwin.on('pointerup', (event) => {
                const position = getPosition(event, rect);
                map.delete(id);
                xnode.emit('dragup', event, { type: 'dragup', position, });
                xwin.finalize();
            });
        });

        base.on('pointermove', (event) => {
            const rect = xnode.element.getBoundingClientRect();
            const position = getPosition(event, rect);

            xnode.emit('move', event, { type: 'move', position });
        });

        base.on('pointerup', (event) => {
            const rect = xnode.element.getBoundingClientRect();
            const position = getPosition(event, rect);

            xnode.emit('up', event, { type: 'up', position });
        });

        function getPosition(event, rect) {
            return { x: event.clientX - rect.left, y: event.clientY - rect.top };
        }
    }

    function AnalogStick(xnode, { size = 130, fill = '#FFF', fillOpacity = 0.8, stroke = '#000', strokeOpacity = 0.8, strokeWidth = 2 } = {}) {
        xnest({ style: `position: relative; width: ${size}px; height: ${size}px; cursor: pointer; user-select: none; overflow: hidden;`, });

        const fillStyle = `fill: ${fill}; fill-opacity: ${fillOpacity};`;
        const strokeStyle = `stroke: ${stroke}; stroke-opacity: ${strokeOpacity}; stroke-width: ${strokeWidth / (size / 100)}; stroke-linejoin: round;`;

        xnew({ tagName: 'svg', style: `position: absolute; width: 100%; height: 100%; user-select: none; ${fillStyle} ${strokeStyle}"`, viewBox: '0 0 100 100' }, `
        <polygon points="50  7 40 18 60 18"></polygon>
        <polygon points="50 93 40 83 60 83"></polygon>
        <polygon points=" 7 50 18 40 18 60"></polygon>
        <polygon points="93 50 83 40 83 60"></polygon>
    `);
        const target = xnew({ tagName: 'svg', style: `position: absolute; width: 100%; height: 100%; user-select: none; ${fillStyle} ${strokeStyle}"`, viewBox: '0 0 100 100' }, `
        <circle cx="50" cy="50" r="23"></circle>
    `);

        const pointer = xnew(PointerEvent);

        pointer.on('down dragmove', (event, { type, position }) => {
            target.element.style.filter = 'brightness(90%)';

            const x = position.x - size / 2;
            const y = position.y - size / 2;
            const d = Math.min(1.0, Math.sqrt(x * x + y * y) / (size / 4));
            const a = (y !== 0 || x !== 0) ? Math.atan2(y, x) : 0;
            const vector = { x: Math.cos(a) * d, y: Math.sin(a) * d };
            xnode.emit(type, event, { type, vector });
            target.element.style.left = vector.x * size / 4 + 'px';
            target.element.style.top = vector.y * size / 4 + 'px';
        });

        pointer.on('dragup', (event, { type }) => {
            target.element.style.filter = '';

            const vector = { x: 0, y: 0 };
            xnode.emit(type, event, { type, vector });
            target.element.style.left = vector.x * size / 4 + 'px';
            target.element.style.top = vector.y * size / 4 + 'px';
        });
    }

    function CircleButton(xnode, { size = 80, fill = '#FFF', fillOpacity = 0.8, stroke = '#000', strokeOpacity = 0.8, strokeWidth = 2 } = {}) {
        xnest({ style: `position: relative; width: ${size}px; height: ${size}px; user-select: none;`, });
        const fillStyle = `fill: ${fill}; fill-opacity: ${fillOpacity};`;
        const strokeStyle = `stroke: ${stroke}; stroke-opacity: ${strokeOpacity}; stroke-width: ${strokeWidth / (size / 100)}; stroke-linejoin: round;`;

        const target = xnew({ tagName: 'svg', style: `width: 100%; height: 100%; cursor: pointer; user-select: none; ${fillStyle} ${strokeStyle}`, viewBox: '0 0 100 100' }, `
        <circle cx="50" cy="50" r="40"></circle>
    `);

        const pointer = xnew(target, PointerEvent);

        pointer.on('down', (event, ex) => {
            target.element.style.filter = 'brightness(90%)';
            xnode.emit('down', event, ex);
        });
        pointer.on('dragup', (event, ex) => {
            target.element.style.filter = '';
            xnode.emit('dragup', event, ex);
        });
    }

    function DPad(xnode, { size = 130, fill = '#FFF', fillOpacity = 0.8, stroke = '#000', strokeOpacity = 0.8, strokeWidth = 2 } = {}) {
        xnest({ style: `position: relative; width: ${size}px; height: ${size}px; cursor: pointer; overflow: hidden; user-select: none;`, });

        const fillStyle = `fill: ${fill}; fill-opacity: ${fillOpacity};`;
        const strokeStyle = `stroke: ${stroke}; stroke-opacity: ${strokeOpacity}; stroke-width: ${strokeWidth / (size / 100)}; stroke-linejoin: round;`;

        const polygons = [
            '<polygon points="50 50 35 35 35  5 37  3 63  3 65  5 65 35"></polygon>',
            '<polygon points="50 50 35 65 35 95 37 97 63 97 65 95 65 65"></polygon>',
            '<polygon points="50 50 35 35  5 35  3 37  3 63  5 65 35 65"></polygon>',
            '<polygon points="50 50 65 35 95 35 97 37 97 63 95 65 65 65"></polygon>'
        ];

        const targets = polygons.map((polygon) => {
            return xnew({
                tagName: 'svg',
                style: `position: absolute; width: 100%; height: 100%; user-select: none; ${fillStyle}"`,
                viewBox: '0 0 100 100'
            }, polygon);
        });
        
        xnew({ tagName: 'svg', style: `position: absolute; width: 100%; height: 100%; user-select: none; fill: none; ${strokeStyle}"`, viewBox: '0 0 100 100' }, `
        <polyline points="35 35 35  5 37  3 63  3 65  5 65 35"></polyline>
        <polyline points="35 65 35 95 37 97 63 97 65 95 65 65"></polyline>
        <polyline points="35 35  5 35  3 37  3 63  5 65 35 65"></polyline>
        <polyline points="65 35 95 35 97 37 97 63 95 65 65 65"></polyline>
        <polygon points="50 11 42 20 58 20"></polygon>
        <polygon points="50 89 42 80 58 80"></polygon>
        <polygon points="11 50 20 42 20 58"></polygon>
        <polygon points="89 50 80 42 80 58"></polygon>
    `);

        const pointer = xnew(PointerEvent);

        pointer.on('down dragmove', (event, { type, position }) => {
            const x = position.x - size / 2;
            const y = position.y - size / 2;
            const a = (y !== 0 || x !== 0) ? Math.atan2(y, x) : 0;
            const d = Math.min(1.0, Math.sqrt(x * x + y * y) / (size / 4));

            const vector = { x: Math.cos(a) * d, y: Math.sin(a) * d };
            vector.x = Math.abs(vector.x) > 0.5 ? Math.sign(vector.x) : 0;
            vector.y = Math.abs(vector.y) > 0.5 ? Math.sign(vector.y) : 0;
            targets[0].element.style.filter = (vector.y < 0) ? 'brightness(90%)' : '';
            targets[1].element.style.filter = (vector.y > 0) ? 'brightness(90%)' : '';
            targets[2].element.style.filter = (vector.x < 0) ? 'brightness(90%)' : '';
            targets[3].element.style.filter = (vector.x > 0) ? 'brightness(90%)' : '';
            xnode.emit(type, event, { type, vector });
        });

        pointer.on('dragup', (event, { type }) => {
            const vector = { x: 0, y: 0 };
            targets[0].element.style.filter = '';
            targets[1].element.style.filter = '';
            targets[2].element.style.filter = '';
            targets[3].element.style.filter = '';
            xnode.emit(type, event, { type, vector });
        });
    }

    function Screen(xnode, { width = 640, height = 480, objectFit = 'contain', pixelated = false } = {}) {
        xnest({ style: 'position: relative; width: 100%; height: 100%; overflow: hidden; user-select: none;' });
        const absolute = xnest({ style: 'position: absolute; inset: 0; margin: auto; user-select: none;' });
        xnest({ style: 'position: relative; width: 100%; height: 100%; user-select: none;' });

        const canvas = xnew({ tagName: 'canvas', width, height, style: 'position: absolute; width: 100%; height: 100%; vertical-align: bottom; user-select: none;' });
        
        if (pixelated === true) {
            canvas.element.style.imageRendering = 'pixelated';
        }
        
        let parentWidth = null;
        let parentHeight = null;

        objectFit = ['fill', 'contain', 'cover'].includes(objectFit) ? objectFit : 'contain';
      
        const xwin = xnew(window);
        xwin.on('resize', resize);

        resize();

        function resize() {
            if (parentWidth === absolute.parentElement.clientWidt && parentHeight === absolute.parentElement.clientHeight) return;
         
            parentWidth = absolute.parentElement.clientWidth;
            parentHeight = absolute.parentElement.clientHeight;

            const aspect = width / height;
           
            let style = { width: '100%', height: '100%', top: '0', left: '0', bottom: '0', right: '0' };
            if (objectFit === 'fill') ; else if (objectFit === 'contain') {
                if (parentWidth < parentHeight * aspect) {
                    style.height = Math.floor(parentWidth / aspect) + 'px';
                } else {
                    style.width = Math.floor(parentHeight * aspect) + 'px';
                }
            } else if (objectFit === 'cover') {
                if (parentWidth < parentHeight * aspect) {
                    style.width = Math.floor(parentHeight * aspect) + 'px';
                    style.left = Math.floor((parentWidth - parentHeight * aspect) / 2) + 'px';
                    style.right = 'auto';
                } else {
                    style.height = Math.floor(parentWidth / aspect) + 'px';
                    style.top = Math.floor((parentHeight - parentWidth / aspect) / 2) + 'px';
                    style.bottom = 'auto';
                }
            }
            Object.assign(absolute.style, style);
        }

        return {
            start() {
                resize();
            },
            get width() {
                return width;
            },
            get height() {
                return height;

            },
            get canvas() {
                return canvas.element;
            }
        }
    }

    function SubWindow(xnode) {
        const absolute = xnest({ style: 'position: absolute;' });
        
        const pointer = xnew(PointerEvent);

        let offset = { x: 0, y: 0 };
        pointer.on('down', (event, { position }) => {
            offset.x = xnode.getPosition().x - position.x;
            offset.y = xnode.getPosition().y - position.y;
        });
        pointer.on('dragmove', (event, { position }) => {
            const moveto = { x: position.x + offset.x, y: position.y + offset.y };
            xnode.emit('dragmove', event, { position: moveto });
        });

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

    const xcomponents = {
        PointerEvent,
        AnalogStick,
        DPad,
        CircleButton,
        Screen,
        SubWindow
    };
    const xcomps = xcomponents;

    exports.xcomponents = xcomponents;
    exports.xcomps = xcomps;
    exports.xcontext = xcontext;
    exports.xextend = xextend;
    exports.xfind = xfind;
    exports.xnest = xnest;
    exports.xnew = xnew;

}));
