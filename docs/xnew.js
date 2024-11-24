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

    class XNode {

        static roots = new Set();
      
        static animation = null;

        static initialize() {
            XNode.roots.forEach((xnode) => xnode.finalize());

            if (XNode.animation) {
                cancelAnimationFrame(XNode.animation);
            }
            XNode.animation = requestAnimationFrame(ticker);
            function ticker() {
                const time = Date.now();
                XNode.roots.forEach((xnode) => xnode._update(time));
                XNode.animation = requestAnimationFrame(ticker);
            }
        }

        static current = null;

        static wrap(node, func, ...args) {
            const backup = XNode.current;
            try {
                XNode.current = node;
                return func(...args);
            } catch (error) {
                throw error;
            } finally {
                XNode.current = backup;
            }
        }

        constructor(parent, element, ...args) {
            parent = (parent instanceof XNode || parent === null) ? parent : XNode.current;
            (parent?._.children ?? XNode.roots).add(this);

            const root = parent !== null ? parent.root : this;
            const base = (element instanceof Element || element === window) ? element : (parent ? parent._.nest : document.body);

            this._ = {
                root,                           // root xnode
                base,                           // base element
                nest: base,                     // nest element
                parent,                         // parent xnode
                children: new Set(),            // xhildren xnodes
                state: 'pending',               // [pending -> running <-> stopped -> finalized]
                props: {},                      // properties in the component function
                components: new Set(),          // conponent functions
                listeners: new Map(),           // event listners
                keys: new Set(),                // keys
                shared: parent?._.shared ?? {}, // shared data between nodes connected
            };

            if (parent === null || ['pending', 'running', 'stopped'].includes(parent._.state)) {
                this._initialize(element, args);
            } else {
                this._.state = 'finalized';
            }
        }

        _initialize(element, args) {
            this.start(); // auto start
        
            if (isObject(element) === true) {
                this.nest(element);
            }

            if (isFunction(args[0])) {
                this._extend(...args);
            } else if (isObject(element) === true && isString(args[0]) === true) {
                this._.nest.innerHTML = args[0];
            }

            // whether the node promise was resolved
            if (this._.props.promise) {
                this._.resolve = false;
                this._.props.promise?.then((response) => { this._.resolve = true; return response; });
            } else {
                this._.resolve = true;
            }
        }

        nest(attributes) {
            if (this._.nest === window) {
                console.error('xnode nest: Cannot be added to window element.');
            } else if (isObject(attributes) === false) {
                console.error('xnode nest: The arguments are invalid.');
            } else if (this._.state !== 'pending') {
                console.error('xnode nest: This can not be called after initialized.');
            } else {
                this.off();

                const element = attributes.tag === 'svg' ? 
                    document.createElementNS('http://www.w3.org/2000/svg', attributes.tag) : 
                    document.createElement(attributes.tag ?? 'div');
                
                Object.keys(attributes).forEach((key) => {
                    const value = attributes[key];
                    if (key === 'style') {
                        if (isString(value) === true) {
                            element.style = value;
                        } else if (isObject(value) === true){
                            Object.assign(element.style, value);
                        }
                    } else if (key === 'class') {
                        if (isString(value) === true) {
                            element.classList.add(...value.split(' '));
                        }
                    } else if (['checked', 'disabled', 'readonly'].includes(key)) {
                        const remap = { checked: 'checked', disabled: 'disabled', readonly: 'readOnly', };
                        element[remap[key]] = value;
                    } else if (key !== 'tag') {
                        element.setAttribute(key, value);
                    }
                });

                this._.nest = this._.nest.appendChild(element);
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

        //----------------------------------------------------------------------------------------------------
        // setup
        //----------------------------------------------------------------------------------------------------
     
        _extend(Component, ...args) {
            const props = XNode.wrap(this, Component, this, ...args) ?? {};
            
            Object.keys(props).forEach((key) => {
                const descripter = Object.getOwnPropertyDescriptor(props, key);

                if (key === 'promise') {
                    if (descripter.value instanceof Promise) {
                        const previous = this._.props[key];
                        this._.props[key] = previous ? Promise.all([previous, descripter.value]) : descripter.value;
                    } else {
                        console.error('xnode extend: The type of "promise" is invalid.');
                    }
                } else if (['start', 'update', 'stop', 'finalize'].includes(key)) {
                    if (isFunction(descripter.value)) {
                        const previous = this._.props[key];
                        this._.props[key] = previous ? (...args) => { previous(...args); descripter.value(...args); } : descripter.value;
                    } else {
                        console.error(`xnode extend: The type of "${key}" is invalid.`);
                    }
                } else {
                    if (this._.props[key] !== undefined || this[key] === undefined) {
                        const dest = { configurable: true, enumerable: true };

                        if (isFunction(descripter.value)) {
                            dest.value = (...args) => XNode.wrap(this, descripter.value, ...args);
                        } else if (descripter.value !== undefined) {
                            dest.value = descripter.value;
                        }
                        if (isFunction(descripter.get)) {
                            dest.get = (...args) => XNode.wrap(this, descripter.get, ...args);
                        }
                        if (isFunction(descripter.set)) {
                            dest.set = (...args) => XNode.wrap(this, descripter.set, ...args);
                        }

                        Object.defineProperty(this._.props, key, dest);
                        Object.defineProperty(this, key, dest);
                    } else {
                        console.error(`xnode extend: "${key}" already exists, can not be redefined.`);
                    }
                }
            });

            const { promise, start, update, stop, finalize, ...others } = props;
            return others;
        }

        extend(Component, ...args) {
            if (isFunction(Component) === false) {
                console.error('xnode extend: The arguments are invalid.');
            } else if (this._.state !== 'pending') {
                console.error('xnode extend: This can not be called after initialized.');
            } else if (this._.components.has(Component) === false) {
                this._.components .add(Component);
                return this._extend(Component, ...args);
            }
        }
      
        //----------------------------------------------------------------------------------------------------
        // system properties
        //----------------------------------------------------------------------------------------------------
     
        start() {
            this._.tostart = true;
        }

        stop() {
            this._.tostart = false;
            this._stop();
        }

        _start(time) {
            if (['pending', 'stopped'].includes(this._.state) && this._.resolve === true && this._.tostart === true) {
                if (this._.parent === null || ['running'].includes(this._.parent.state)) {
                    this._.startTime = time;
                    this._.state = 'running';
                    this._.children.forEach((node) => node._start(time));
                
                    if (this._.state === 'running' && isFunction(this._.props.start)) {
                        XNode.wrap(this, this._.props.start);
                    }
                }
            }
        }

        _stop() {
            if (['running'].includes(this._.state)) {
                this._.state = 'stopped';
                this._.children.forEach((node) => node._stop());

                if (this._.state === 'stopped' && isFunction(this._.props.stop)) {
                    XNode.wrap(this, this._.props.stop);
                }
            }
        }

        _update(time) {
            if (['pending', 'running', 'stopped'].includes(this._.state)) {
                if (this._.tostart === true) this._start(time);

                this._.children.forEach((node) => node._update(time));

                if (this._.state === 'running' && isFunction(this._.props.update) === true) {
                    XNode.wrap(this, this._.props.update, time - this._.startTime);
                }
            }
        }

        finalize() {
            this._stop();

            if (['pending', 'stopped'].includes(this._.state)) {
                this._finalize();
                
                // relation
                (this._.parent?._.children ?? XNode.roots).delete(this);

                this._.state = 'finalized';
            }
        }

        _finalize() {
            [...this._.children].forEach((node) => node.finalize());
                
            if (isFunction(this._.props.finalize)) {
                XNode.wrap(this, this._.props.finalize);
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
        }

        //----------------------------------------------------------------------------------------------------
        // context value
        //----------------------------------------------------------------------------------------------------        

        context(name, value = undefined) {
            if (isString(name) === false) {
                console.error('xnode context: The arguments are invalid.');
            } else {
                let ret = undefined;
                let node = this;
                while (node !== null) {
                    if (node._.context?.has(name)) {
                        ret = node._.context.get(name);
                    }
                    node = node.parent;
                }
                if (value !== undefined) {
                    this._.context = this._.context ?? new Map();
                    this._.context.set(name, value);
                }
                return ret;
            }
        }

        //----------------------------------------------------------------------------------------------------
        // key
        //----------------------------------------------------------------------------------------------------
       
        static keyMap = new Map();

        set key(key) {
            if (isString(key) === false) {
                console.error('xnode key: The arguments are invalid.');
            } else {
                // clear all
                this._.keys.forEach((key) => {
                    if (XNode.keyMap.has(key) === false) return;
                    XNode.keyMap.get(key).delete(this);
                    if (XNode.keyMap.get(key).size === 0) XNode.keyMap.delete(key);
                    this._.keys.delete(key);
                });

                // set keys
                key.split(' ').filter((key) => key !== '').forEach((key) => {
                    if (XNode.keyMap.has(key) === false) XNode.keyMap.set(key, new Set());
                    XNode.keyMap.get(key).add(this);
                    this._.keys.add(key);
                });
            }
        }

        get key() {
            return [...this._.keys].join(' ');
        }
        
        //----------------------------------------------------------------------------------------------------
        // event
        //----------------------------------------------------------------------------------------------------
       
        static eventTypeMap = new Map();
        
        on(type, listener, options) {
            if (isString(type) === false || isFunction(listener) === false) {
                console.error('xnode on: The arguments are invalid.');
            } else {
                type.split(' ').filter((type) => type !== '').forEach((type) => {

                    addEventListener.call(this, type, listener, options);

                    if (XNode.eventTypeMap.has(type) === false) XNode.eventTypeMap.set(type, new Set());
                    if (XNode.eventTypeMap.get(type).has(this) === false) {
                        XNode.eventTypeMap.get(type).add(this);
                    }
                });
            }

            function addEventListener(type, listener, options) {
                if (this._.listeners.has(type) === false) this._.listeners.set(type, new Map());
                if (this._.listeners.get(type).has(listener) === false) {
                    const wrapListener = (...args) => XNode.wrap(this, listener, ...args);

                    this._.listeners.get(type).set(listener, wrapListener);
                    this._.nest.addEventListener(type, wrapListener, options);
                }
            }
        }

        off(type, listener) {
            if ((type !== undefined && isString(type) === false) || (listener !== undefined && isFunction(listener) === false)) {
                console.error('xnode off: The arguments are invalid.');
            } else {
                type = type ?? [...this._.listeners.keys()].join(' ');

                type.split(' ').filter((type) => type !== '').forEach((type) => {
                    
                    if (this._.listeners.has(type) === true) {
                        if (isFunction(listener) === true) {
                            removeEventListener.call(this, type, listener);
                        } else if (listener === undefined) {
                            [...this._.listeners.get(type).keys()].forEach((listener) => removeEventListener.call(this, type, listener));
                        }

                        if (this._.listeners.has(type) === false && XNode.eventTypeMap.has(type) === true) {
                            XNode.eventTypeMap.get(type).delete(this);
                            if (XNode.eventTypeMap.get(type).size === 0) XNode.eventTypeMap.delete(type);
                        }
                    }
                });
            }

            function removeEventListener(type, listener) {
                if (this._.listeners.has(type) === true && this._.listeners.get(type).has(listener) === true) {
                    const wrapListener = this._.listeners.get(type).get(listener);

                    this._.listeners.get(type).delete(listener);
                    if (this._.listeners.get(type).size === 0) this._.listeners.delete(type);

                    this._.nest.removeEventListener(type, wrapListener);
                }
            }
        }

        emit(type, ...args) {
            if (isString(type) === false) {
                console.error('xnode emit: The arguments are invalid.');
            } else if (this._.state === 'finalized') {
                console.error('xnode emit: This can not be called after finalized.');
            } else {
                type.split(' ').filter((type) => type !== '').forEach((type) => {
                    if (type[0] === '#') {
                        if (XNode.eventTypeMap.has(type)) {
                            XNode.eventTypeMap.get(type).forEach((node) => emit.call(node, type, ...args));
                        }
                    } else {
                        emit.call(this, type, ...args);
                    }
                });
            }

            function emit(type, ...args) {
                if (this._.listeners.has(type) === true) {
                    this._.listeners.get(type).forEach((listener) => listener(...args));
                }
            }
        }
    }

    XNode.initialize();

    function xnew(...args) {

        // parent xnode
        let parent = undefined;
        if (args[0] instanceof XNode || args[0] === null || args[0] === undefined) {
            parent = args.shift();
        }

        // base element
        let element = undefined;
        if (args[0] instanceof Element || args[0] === window || isObject(args[0]) || args[0] === null || args[0] === undefined) {
            element = args.shift();
        }

        if (args.length === 0 || isFunction(args[0]) || (isObject(element) && isString(args[0]))) {
            return new XNode(parent, element, ...args);
        } else {
            console.error('xnew: The arguments are invalid.');
        }
    }

    function xfind(key) {
        if (isString(key) === false) {
            console.error('xfind: The arguments are invalid.');
        } else {
            const set = new Set();
            key.split(' ').filter((key) => XNode.keyMap.has(key)).forEach((key) => {
                XNode.keyMap.get(key).forEach((xnode) => set.add(xnode));
            });
            return [...set];
        }
    }

    function xtimer$1(callback, delay = 0) {
        
        return xnew((xnode) => {
            let id = null;
            let timeout = delay;
            let offset = 0.0;
            let start = 0.0;
            let time = 0.0;

            return {
                get time() {
                    return time;
                },
                start() {
                    start = Date.now();
                    time = offset;
                    id = setTimeout(wcallback, timeout - time);
                },
                update() {
                    time = Date.now() - start + offset;
                },
                stop() {
                    offset = Date.now() - start + offset;
                    clearTimeout(id);
                    id = null;
                },
                finalize() {
                    if (id !== null) {
                        clearTimeout(id);
                    }
                },
            }

            function wcallback() {
                const repeat = XNode.wrap(xnode.parent, callback);
                if (repeat === true) {
                    xnode.stop();
                    offset = 0.0;
                    xnode.start();
                } else {
                    xnode.finalize();
                }
            }
        });
    }

    function DragEvent(xnode) {
        const base = xnew();
        const xwin = xnew(window);

        // prevent touch default event
        base.on('touchstart', (event) => {
            event.preventDefault();
        });

        base.on('pointerdown', (event) => {
            const id = getId(event);
            let position = getPosition(event, id);
            let prev = position;

            xnode.emit('down', event, { type: 'down', position, });

            xwin.on('pointermove', (event) => {
                position = getPosition(event, id);
                if (position !== null) {
                    const delta = { x: position.x - prev.x, y: position.y - prev.y };
                    xnode.emit('move', event, { type: 'move', position, delta, });
                    prev = position;
                }
            });

            xwin.on('pointerup', (event) => {
                position = getPosition(event, id);
                if (position !== null) {
                    xnode.emit('up', event, { type: 'up', position, });
                    xwin.off();
                }
            });
        });

        function getId(event) {
            if (event.pointerId !== undefined) {
                return event.pointerId;
            } else if (event.changedTouches !== undefined) {
                return event.changedTouches[event.changedTouches.length - 1].identifier;
            } else {
                return null;
            }
        }

        function getPosition(event, id) {
            let original = null;
            if (event.pointerId !== undefined) {
                if (id === event.pointerId) original = event;
            } else if (event.changedTouches !== undefined) {
                for (let i = 0; i < event.changedTouches.length; i++) {
                    if (id === event.changedTouches[i].identifier) original = event.changedTouches[i];
                }
            } else {
                original = event;
            }
            if (original === null) return null;

            const rect = xnode.element.getBoundingClientRect();
           
            let scaleX = 1.0;
            let scaleY = 1.0;
            if (xnode.element.tagName.toLowerCase() === 'canvas' && Number.isFinite(xnode.element.width) && Number.isFinite(xnode.element.height)) {
                scaleX = xnode.element.width / rect.width;
                scaleY = xnode.element.height / rect.height;
            }
            return { x: scaleX * (original.clientX - rect.left), y: scaleY * (original.clientY - rect.top) };
        }
    }

    function AnalogStick(xnode, { size = 130, fill = '#FFF', fillOpacity = 0.8, stroke = '#000', strokeOpacity = 0.8, strokeWidth = 2 } = {}) {
        xnode.nest({ style: `position: relative; width: ${size}px; height: ${size}px; cursor: pointer; user-select: none; overflow: hidden;`, });

        const fillStyle = `fill: ${fill}; fill-opacity: ${fillOpacity};`;
        const strokeStyle = `stroke: ${stroke}; stroke-opacity: ${strokeOpacity}; stroke-width: ${strokeWidth / (size / 100)}; stroke-linejoin: round;`;

        xnew({ tag: 'svg', style: `position: absolute; width: 100%; height: 100%; user-select: none; ${fillStyle} ${strokeStyle}"`, viewBox: '0 0 100 100' }, `
        <polygon points="50  7 40 18 60 18"></polygon>
        <polygon points="50 93 40 83 60 83"></polygon>
        <polygon points=" 7 50 18 40 18 60"></polygon>
        <polygon points="93 50 83 40 83 60"></polygon>
    `);
        const target = xnew({ tag: 'svg', style: `position: absolute; width: 100%; height: 100%; user-select: none; ${fillStyle} ${strokeStyle}"`, viewBox: '0 0 100 100' }, `
        <circle cx="50" cy="50" r="23"></circle>
    `);

        const drag = xnew(DragEvent);

        drag.on('down move', (event, { type, position }) => {
            target.element.style.filter = 'brightness(90%)';

            const [x, y] = [position.x - size / 2, position.y - size / 2];
            const d = Math.min(1.0, Math.sqrt(x * x + y * y) / (size / 4));
            const a = (y !== 0 || x !== 0) ? Math.atan2(y, x) : 0;
            const vector = { x: Math.cos(a) * d, y: Math.sin(a) * d };
            xnode.emit(type, event, { type, vector });
            [target.element.style.left, target.element.style.top] = [vector.x * size / 4 + 'px', vector.y * size / 4 + 'px'];
        });

        drag.on('up', (event, { type }) => {
            target.element.style.filter = '';

            const vector = { x: 0, y: 0 };
            xnode.emit(type, event, { type, vector });
            [target.element.style.left, target.element.style.top] = [vector.x * size / 4 + 'px', vector.y * size / 4 + 'px'];
        });
    }

    function CircleButton(xnode, { size = 80, fill = '#FFF', fillOpacity = 0.8, stroke = '#000', strokeOpacity = 0.8, strokeWidth = 2 } = {}) {
        xnode.nest({ style: `position: relative; width: ${size}px; height: ${size}px; user-select: none;`, });

        const fillStyle = `fill: ${fill}; fill-opacity: ${fillOpacity};`;
        const strokeStyle = `stroke-linejoin: round; stroke: ${stroke}; stroke-opacity: ${strokeOpacity}; stroke-width: ${strokeWidth / (size / 100)};`;

        const target = xnew({ tag: 'svg', name: 'target', style: `width: 100%; height: 100%; cursor: pointer; user-select: none; ${fillStyle} ${strokeStyle}`, viewBox: '0 0 100 100' }, `
        <circle cx="50" cy="50" r="40"></circle>
    `);

        target.on('pointerdown', down);

        // prevent touch default event
        target.on('touchstart', (event) => {
            event.preventDefault();
        });

        function down(event) {
            target.element.style.filter = 'brightness(90%)';
            const type = 'down';
            xnode.emit(type, event, { type });

            window.addEventListener('pointerup', up);
        }
        function up(event) {
            target.element.style.filter = '';
            const type = 'up';
            xnode.emit(type, event, { type });

            window.removeEventListener('pointerup', up);
        }

        return {
            finalize() {
                window.removeEventListener('pointerup', up);
            },
        }
    }

    function DPad(xnode, { size = 130, fill = '#FFF', fillOpacity = 0.8, stroke = '#000', strokeOpacity = 0.8, strokeWidth = 2 } = {}) {
        xnode.nest({ style: `position: relative; width: ${size}px; height: ${size}px; cursor: pointer; overflow: hidden; user-select: none;`, });

        const fillStyle = `fill: ${fill}; fill-opacity: ${fillOpacity};`;
        const strokeStyle = `stroke: ${stroke}; stroke-opacity: ${strokeOpacity}; stroke-width: ${strokeWidth / (size / 100)}; stroke-linejoin: round;`;

        const targets = new Array(4);
        targets[0] = xnew({ tag: 'svg', style: `position: absolute; width: 100%; height: 100%; user-select: none; ${fillStyle}"`, viewBox: '0 0 100 100' }, `
        <polygon points="50 50 35 35 35  5 37  3 63  3 65  5 65 35"></polygon>
    `);
        targets[1] = xnew({ tag: 'svg', style: `position: absolute; width: 100%; height: 100%; user-select: none; ${fillStyle}"`, viewBox: '0 0 100 100' }, `
        <polygon points="50 50 35 65 35 95 37 97 63 97 65 95 65 65"></polygon>
    `);
        targets[2] = xnew({ tag: 'svg', style: `position: absolute; width: 100%; height: 100%; user-select: none; ${fillStyle}"`, viewBox: '0 0 100 100' }, `
        <polygon points="50 50 35 35  5 35  3 37  3 63  5 65 35 65"></polygon>
    `);
        targets[3] = xnew({ tag: 'svg', style: `position: absolute; width: 100%; height: 100%; user-select: none; ${fillStyle}"`, viewBox: '0 0 100 100' }, `
        <polygon points="50 50 65 35 95 35 97 37 97 63 95 65 65 65"></polygon>
    `);

        xnew({ tag: 'svg', style: `position: absolute; width: 100%; height: 100%; user-select: none; fill: none; ${strokeStyle}"`, viewBox: '0 0 100 100' }, `
        <polyline points="35 35 35  5 37  3 63  3 65  5 65 35"></polyline>
        <polyline points="35 65 35 95 37 97 63 97 65 95 65 65"></polyline>
        <polyline points="35 35  5 35  3 37  3 63  5 65 35 65"></polyline>
        <polyline points="65 35 95 35 97 37 97 63 95 65 65 65"></polyline>
        <polygon points="50 11 42 20 58 20"></polygon>
        <polygon points="50 89 42 80 58 80"></polygon>
        <polygon points="11 50 20 42 20 58"></polygon>
        <polygon points="89 50 80 42 80 58"></polygon>
    `);

        const drag = xnew(DragEvent);

        drag.on('down move', (event, { type, position }) => {
            const [x, y] = [position.x - size / 2, position.y - size / 2];
            const a = (y !== 0 || x !== 0) ? Math.atan2(y, x) : 0;
            const d = Math.min(1.0, Math.sqrt(x * x + y * y) / (size / 4));
            const vector = { x: Math.cos(a) * d, y: Math.sin(a) * d };
            vector.x = vector.x > +0.4 ? +1 : (vector.x < -0.4 ? -1 : 0);
            vector.y = vector.y > +0.4 ? +1 : (vector.y < -0.4 ? -1 : 0);

            targets[0].element.style.filter = (vector.y < 0) ? 'brightness(90%)' : '';
            targets[1].element.style.filter = (vector.y > 0) ? 'brightness(90%)' : '';
            targets[2].element.style.filter = (vector.x < 0) ? 'brightness(90%)' : '';
            targets[3].element.style.filter = (vector.x > 0) ? 'brightness(90%)' : '';

            xnode.emit(type, event, { type, vector });
        });

        drag.on('up', (event, { type }) => {
            for(let i = 0; i < 4; i++) {
                targets[i].element.style.filter = '';
            }
            const vector = { x: 0, y: 0 };
            xnode.emit(type, event, { type, vector });
        });
    }

    function Screen(xnode, { width = 640, height = 480, objectFit = 'contain', pixelated = false } = {}) {
        xnode.nest({ style: 'position: relative; width: 100%; height: 100%; overflow: hidden; user-select: none;' });
        xnode.nest({ style: 'position: absolute; inset: 0; margin: auto; user-select: none;' });
        const absolute = xnode.element;
        xnode.nest({ style: 'position: relative; width: 100%; height: 100%; user-select: none;' });

        const canvas = xnew({ tag: 'canvas', width, height, style: 'position: absolute; width: 100%; height: 100%; vertical-align: bottom; user-select: none;' });
        
        if (pixelated === true) {
            canvas.element.style.imageRendering = 'pixelated';
        }
        
        let parentWidth = null;
        let parentHeight = null;

        objectFit = ['fill', 'contain', 'cover'].includes(objectFit) ? objectFit : 'contain';
      
        const xwin = xnew(window);
        xwin.on('resize', resize);

        xtimer(() => resize());
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
            get width() { return width; },
            get height() { return height; },
            get canvas() { return canvas.element; }
        }
    }

    const xcomponents = {
        AnalogStick,
        CircleButton,
        DPad,
        DragEvent,
        Screen
    };

    exports.xcomponents = xcomponents;
    exports.xfind = xfind;
    exports.xnew = xnew;
    exports.xtimer = xtimer$1;

}));
