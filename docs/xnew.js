
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

        static current = null;

        static roots = new Set();
        
        static wrap(node, func, ...args) {
            if (node === XNode.current) {
                return func(...args);
            } else {
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
        }

        static updateTime = null;

        static {
            (() => {
                requestAnimationFrame(ticker);
            
                function ticker() {
                    XNode.updateTime = Date.now();
                    XNode.roots.forEach((xnode) => xnode._update());
                    requestAnimationFrame(ticker);
                }
            })();
        }

        constructor(parent, element, ...content) {
            // internal data
            this._ = {};

            this._.parent = (parent instanceof XNode || parent === null) ? parent : XNode.current;
            this._.element = element;
            this._.content = content;

            // relation
            (this._.parent?._.children ?? XNode.roots).add(this);
            this._.children = new Set();

            this._.root = this._.parent !== null ? this._.parent.root : this;

            // state [pending -> running <-> stopped -> finalized]
            this._.state = 'pending';  

            // properties defined in the component function
            this._.defines = {};

            // conponent functions
            this._.ComponentSet = new Set();

            // event listners
            this._.listeners = new Map();

            // keys
            this._.keySet = new Set();

            // base ellement (fixed)
            this._.base = (this._.element instanceof Element) ? this._.element : (this._.parent ? this._.parent._.nest : document.body);

            // shared data between nodes connected by parent-child relationship
            this._.shared = this._.parent?._.shared ?? {};

            if (this._.parent === null || ['pending', 'running', 'stopped'].includes(this._.parent._.state)) {
                this._initialize();
            } else {
                this._.state = 'finalized';
            }
        }

        _initialize() {
            this._.nest = this._.base;

            if (isString(this._.content[0]) || isObject(this._.element)) {
                this.nest(isObject(this._.element) ? this._.element : {});
            }

            // auto start
            this.start();

            // content
            if (isFunction(this._.content[0])) {
                this._extend(...this._.content);
            } else if (isString(this._.content[0])) {
                this._.nest.innerHTML = this._.content[0];
            }

            // whether the node promise was resolved
            if (this._.defines.promise) {
                this._.resolve = false;
                this._.defines.promise?.then((response) => { this._.resolve = true; return response; });
            } else {
                this._.resolve = true;
            }
        }

        nest(attributes) {
            if (isObject(attributes) === false) {
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
            return this._.defines.promise ?? Promise.resolve();
        }

        get state() {
            return this._.state
        }

        //----------------------------------------------------------------------------------------------------
        // setup
        //----------------------------------------------------------------------------------------------------
     
        _extend(Component, ...args) {
            const defines = XNode.wrap(this, Component, this, ...args) ?? {};
            
            Object.keys(defines).forEach((key) => {
                const descripter = Object.getOwnPropertyDescriptor(defines, key);

                if (key === 'promise') {
                    if (descripter.value instanceof Promise) {
                        const previous = this._.defines[key];
                        this._.defines[key] = previous ? Promise.all([previous, descripter.value]) : descripter.value;
                    } else {
                        console.error('xnode extend: The type of "promise" is invalid.');
                    }
                } else if (['start', 'update', 'stop', 'finalize'].includes(key)) {
                    if (isFunction(descripter.value)) {
                        const previous = this._.defines[key];
                        this._.defines[key] = previous ? (...args) => { previous(...args); descripter.value(...args); } : descripter.value;
                    } else {
                        console.error(`xnode extend: The type of "${key}" is invalid.`);
                    }
                } else {
                    if (this._.defines[key] !== undefined || this[key] === undefined) {
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

                        Object.defineProperty(this._.defines, key, dest);
                        Object.defineProperty(this, key, dest);
                    } else {
                        console.error(`xnode extend: "${key}" already exists, can not be redefined.`);
                    }
                }
            });

            const { promise, start, update, stop, finalize, ...others } = defines;
            return others;
        }

        extend(Component, ...args) {
            if (isFunction(Component) === false) {
                console.error('xnode extend: The arguments are invalid.');
            } else if (this._.state !== 'pending') {
                console.error('xnode extend: This can not be called after initialized.');
            } else if (this._.ComponentSet.has(Component) === false) {
                this._.ComponentSet .add(Component);
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

        _start() {
            if (['pending', 'stopped'].includes(this._.state)) {
                if ((this._.parent === null || this._.parent.state === 'running') && this._.resolve === true && this._.tostart === true) {
                    this._.startTime = XNode.updateTime;
                    this._.state = 'running';
                    this._.children.forEach((node) => node._start());
                
                    if (this._.state === 'running' && isFunction(this._.defines.start)) {
                        XNode.wrap(this, this._.defines.start);
                    }
                }
            }
        }

        _stop() {
            if (['running'].includes(this._.state)) {
                this._.state = 'stopped';
                this._.children.forEach((node) => node._stop());

                if (this._.state === 'stopped' && isFunction(this._.defines.stop)) {
                    XNode.wrap(this, this._.defines.stop);
                }
            }
        }

        _update() {
            if (['pending', 'running', 'stopped'].includes(this._.state)) {
                if (this._.tostart === true) this._start();

                this._.children.forEach((node) => node._update());

                if (this._.state === 'running' && isFunction(this._.defines.update) === true) {
                    XNode.wrap(this, this._.defines.update, XNode.updateTime - this._.startTime);
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
                
            if (isFunction(this._.defines.finalize)) {
                XNode.wrap(this, this._.defines.finalize);
            }

            // key
            this.key = '';

            // event
            this.off();
            
            // reset define
            Object.keys(this._.defines).forEach((key) => {
                if (['promise', 'start', 'update', 'stop', 'finalize'].includes(key)) {
                    delete this._.defines[key];
                } else {
                    delete this._.defines[key];
                    delete this[key];
                }
            });

            // element
            if (this._.nest !== null && this._.nest !== this._.base) {
                let target = this._.nest;
                while (target.parentElement !== null && target.parentElement !== this._.base) { target = target.parentElement; }
                if (target.parentElement === this._.base) {
                    this._.base.removeChild(target);
                }
            }
        }

        //----------------------------------------------------------------------------------------------------
        // context property
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
                this._.keySet.forEach((key) => {
                    if (XNode.keyMap.has(key) === false) return;
                    XNode.keyMap.get(key).delete(this);
                    if (XNode.keyMap.get(key).size === 0) XNode.keyMap.delete(key);
                    this._.keySet.delete(key);
                });

                // set keys
                key.split(' ').filter((key) => key !== '').forEach((key) => {
                    if (XNode.keyMap.has(key) === false) XNode.keyMap.set(key, new Set());
                    XNode.keyMap.get(key).add(this);
                    this._.keySet.add(key);
                });
            }
        }

        get key() {
            return [...this._.keySet].join(' ');
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

    function xnew(...args) {
        const e = document.createElement('div');
        e.innerText = 'aaa';
        document.body.appendChild(e);
        // a parent xnode
        let parent = undefined;
        if (args[0] instanceof XNode || args[0] === null || args[0] === undefined) {
            parent = args.shift();
        }


        let element = undefined;
        if (args[0] instanceof Element || isObject(args[0]) || args[0] === null || args[0] === undefined) {
            element = args.shift();
        }

        // Component function (+args), or innerHTML
        const content = args;

        return new XNode(parent, element, ...content);
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

    function xtimer(callback, delay) {
        
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

        let id = null;
        let current = null;
        
        base.on('pointerdown', down);

        // prevent touch default event
        base.on('touchstart', (event) => {
            event.preventDefault();
        });

        function down(event) {
            const position = getPosition(event, id = getId(event));
            current = position;

            const type = 'down';
            xnode.emit(type, event, { type, position, });
            window.addEventListener('pointermove', move);
            window.addEventListener('pointerup', up);
        }    function move(event) {
            const position = getPosition(event, id);
            if (position === null) return;

            const delta = { x: position.x - current.x, y: position.y - current.y };
            current = position;

            const type = 'move';
            xnode.emit(type, event, { type, position, delta, });
        }    function up(event) {
            const position = getPosition(event, id);
            if (position === null) return;
            
            const type = 'up';
            xnode.emit(type, event, { type, position, });
            id = null;
            current = null;
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
        }
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

        return {
            finalize() {
                window.removeEventListener('pointermove', move);
                window.removeEventListener('pointerup', up);
            }
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
        xnode.nest({ style: 'position: relative; width: 100%; height: 100%; user-select: none;' });
        const absolute = xnode.element.parentElement;

        const canvas = xnew({ tag: 'canvas', width, height, style: 'position: absolute; width: 100%; height: 100%; vertical-align: bottom; user-select: none;' });
        
        if (pixelated === true) {
            canvas.element.style.imageRendering = 'pixelated';
        }
        
        let parentWidth = null;
        let parentHeight = null;

        objectFit = ['fill', 'contain', 'cover'].includes(objectFit) ? objectFit : 'contain';
      
        window.addEventListener('resize', resize);

        xtimer(() => resize());
        xtimer(() => resize(), 1000, true);
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
            finalize() {
                window.removeEventListener('resize', resize);  
            },
            width,
            height,
            canvas: canvas.element,
        }
    }

    const xcomponents = {
        AnalogStick,
        CircleButton,
        DPad,
        DragEvent,
        Screen
    };

 
