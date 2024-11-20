(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.window = global.window || {}));
})(this, (function (exports) { 'use strict';

    function isString(value) {
        return typeof value === 'string';
    }

    function isFunction(value) {
        return typeof value === 'function';
    }

    function isNumber(value) {
        return Number.isFinite(value);
    }

    function isObject(value) {
        return value !== null && typeof value === 'object' && value.constructor === Object;
    }

    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    //----------------------------------------------------------------------------------------------------
    // errors
    //----------------------------------------------------------------------------------------------------

    const ERRORS = {
        ARGUMENT: 'The arguments are invalid.',
        BASIC_STRING: 'The arguments are invalid because it contains characters can not be used. Only [A-Z, a-z, 0-9, _, .] are available.', 
    };

    //----------------------------------------------------------------------------------------------------
    // xnew
    //----------------------------------------------------------------------------------------------------

    function xnew(...args) {

        // a parent node
        const parent = (args[0] instanceof XNode || args[0] === null || args[0] === undefined) ? args.shift() : undefined;

        // an existing html element or attributes to create a html element
        const element = (args[0] instanceof Element || isObject(args[0]) || args[0] === null || args[0] === undefined) ? args.shift() : undefined;

        // Component function (+args), or innerHTML
        const content = args;

        return new XNode(parent, element, ...content);
    }

    //----------------------------------------------------------------------------------------------------
    // xwrap
    //----------------------------------------------------------------------------------------------------

    function xwrap(node, func, ...args) {
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

    //----------------------------------------------------------------------------------------------------
    // xfind
    //----------------------------------------------------------------------------------------------------

    function xfind(key) {
        if (isString(key) === false) {
            console.error('xfind: ' + ERRORS.ARGUMENT);
        } else {
            const set = new Set();
            key.split(' ').filter((key) => XNode.keyMap.has(key)).forEach((key) => {
                XNode.keyMap.get(key).forEach((node) => set.add(node));
            });
            return [...set];
        }
    }

    //----------------------------------------------------------------------------------------------------
    // xtimer
    //----------------------------------------------------------------------------------------------------

    function xtimer$1(callback, delay, repeat = false) {
        
        return xnew((node) => {
            let id = null;
            
            setTimeout(func, delay);

            return {
                finalize() {
                    if (id !== null) {
                        clearTimeout(id);
                        id = null;
                    }
                },
            }

            function func() {
                xwrap(node.parent, callback);
                if (repeat === true) {
                    id = setTimeout(func, delay);
                } else {
                    node.finalize();
                }
            }
        });
    }

    //----------------------------------------------------------------------------------------------------
    // node
    //----------------------------------------------------------------------------------------------------

    class XNode {

        static current = null;

        static roots = new Set();
      
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

            // phase [pre initialized ->stopped ->started ->... ->stopped ->pre finalized ->finalized]
            this._.phase = 'pre initialized';  

            // properties defined in the component function
            this._.defines = {};

            // conponent functions
            this._.ComponentSet = new Set();

            // event listners
            this._.listeners = new Map();

            // keys
            this._.keySet = new Set();

            // base ellement (fixed)
            this._.baseElement = (this._.element instanceof Element) ? this._.element : (this._.parent ? this._.parent._.nestElement : document.body);

            // shared data between nodes connected by parent-child relationship
            this._.shared = this._.parent?._.shared ?? {};

            if (this._.parent === null || this._.parent._.phase === 'pre initialized' || this._.parent._.phase === 'stopped' || this._.parent._.phase === 'started') {
                this._initialize();

                this._.phase = 'stopped';
            } else {
                this._.phase = 'finalized';
            }
        }

        _initialize() {
            this._.nestElement = this._.baseElement;

            if (isString(this._.content[0]) || isObject(this._.element)) {
                this.nestElement(isObject(this._.element) ? this._.element : {});
            }

            // auto start
            this.start();

            // content
            if (isFunction(this._.content[0])) {
                this._extend(...this._.content);
            } else if (isString(this._.content[0])) {
                this._.nestElement.innerHTML = this._.content[0];
            }

            // whether the node promise was resolved
            if (this._.defines.promise) {
                this._.resolve = false;
                this._.defines.promise?.then((response) => { this._.resolve = true; return response; });
            } else {
                this._.resolve = true;
            }
        }

        nestElement(attributes) {
            if (isObject(attributes) === false) {
                console.error('XNode nestElement: ' + ERRORS.ARGUMENT);
            } else if (this._.phase !== 'pre initialized') {
                console.error('XNode nestElement: ' + 'This can not be called after initialized.');
            } else {
                this.off();
                this._.nestElement = this._.nestElement.appendChild(createElement(attributes));
            }
        }

        //----------------------------------------------------------------------------------------------------
        // basic
        //----------------------------------------------------------------------------------------------------
        
        get parent() {
            return this._.parent;
        }

        get element() {
            return this._.nestElement;
        }

        get shared() {
            return this._.shared;
        }

        //----------------------------------------------------------------------------------------------------
        // setup
        //----------------------------------------------------------------------------------------------------
     
        _extend(Component, ...args) {
            const defines = xwrap(this, Component, this, ...args) ?? {};
            
            Object.keys(defines).forEach((key) => {
                const descripter = Object.getOwnPropertyDescriptor(defines, key);

                if (key === 'promise') {
                    if (descripter.value instanceof Promise) {
                        const previous = this._.defines[key];
                        this._.defines[key] = previous ? Promise.all([previous, descripter.value]) : descripter.value;
                    } else {
                        console.error('XNode define: ' + 'the type of "promise" is invalid.');
                    }
                } else if (['start', 'update', 'stop', 'finalize'].includes(key)) {
                    if (isFunction(descripter.value)) {
                        const previous = this._.defines[key];
                        this._.defines[key] = previous ? (...args) => { previous(...args); descripter.value(...args); } : descripter.value;
                    } else {
                        console.error('XNode define: ' + `the type of "${key}" is invalid.`);
                    }
                } else {
                    if (this._.defines[key] !== undefined || this[key] === undefined) {
                        const dest = { configurable: true, enumerable: true };

                        if (isFunction(descripter.value)) {
                            dest.value = (...args) => xwrap(this, descripter.value, ...args);
                        } else if (descripter.value !== undefined) {
                            dest.value = descripter.value;
                        }
                        if (isFunction(descripter.get)) {
                            dest.get = (...args) => xwrap(this, descripter.get, ...args);
                        }
                        if (isFunction(descripter.set)) {
                            dest.set = (...args) => xwrap(this, descripter.set, ...args);
                        }

                        Object.defineProperty(this._.defines, key, dest);
                        Object.defineProperty(this, key, dest);
                    } else {
                        console.error('XNode define: ' + `"${key}" already exists, can not be redefined.`);
                    }
                }
            });

            const { promise, start, update, stop, finalize, ...others } = defines;
            return others;
        }

        extend(Component, ...args) {
            if (isFunction(Component) === false) {
                console.error('XNode extend: ' + ERRORS.ARGUMENT);
            } else if (this._.phase !== 'pre initialized') {
                console.error('XNode extend: ' + 'This can not be called after initialized.');
            } else if (this._.ComponentSet.has(Component) === false) {
                this._.ComponentSet .add(Component);
                return this._extend(Component, ...args);
            }
        }
      
        //----------------------------------------------------------------------------------------------------
        // system properties
        //----------------------------------------------------------------------------------------------------
     
        static updateCounter = 0;

        static updateTime = null;

        get promise() {
            return this._.defines.promise ?? Promise.resolve();
        }

        start() {
            this._.tostart = true;
        }

        stop() {
            this._.tostart = false;
            this._stop();
        }

        _start() {
            if (this._.phase === 'stopped' && (this._.parent === null || this._.parent.isStarted()) && this._.resolve === true && this._.tostart === true) {
                this._.startTime = XNode.updateTime;
                this._.phase = 'started';
                this._.children.forEach((node) => node._start());
            
                if (this._.phase === 'started' && isFunction(this._.defines.start)) {
                    xwrap(this, this._.defines.start);
                }
            }
        }

        _stop() {
            if (this._.phase === 'started') {
                this._.phase = 'stopped';
                this._.children.forEach((node) => node._stop());

                if (this._.phase === 'stopped' && isFunction(this._.defines.stop)) {
                    xwrap(this, this._.defines.stop);
                }
            }
        }

        _update() {

            if (this._.phase === 'started' || this._.phase === 'stopped') {
                if (this._.tostart === true) this._start();

                this._.children.forEach((node) => node._update());

                if (this._.phase === 'started' && isFunction(this._.defines.update) === true) {
                    xwrap(this, this._.defines.update, XNode.updateTime - this._.startTime);
                }
            }
        }

        finalize() {
            this._stop();

            if (this._.phase === 'stopped') {
                this._.phase = 'pre finalized';

                this._finalize();
                
                // relation
                (this._.parent?._.children ?? XNode.roots).delete(this);

                this._.phase = 'finalized';
            }
        }

        _finalize() {
            [...this._.children].forEach((node) => node.finalize());
                
            if (isFunction(this._.defines.finalize)) {
                xwrap(this, this._.defines.finalize);
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
            if (this._.nestElement !== null && this._.nestElement !== this._.baseElement) {
                let target = this._.nestElement;
                while (target.parentElement !== null && target.parentElement !== this._.baseElement) { target = target.parentElement; }
                if (target.parentElement === this._.baseElement) {
                    this._.baseElement.removeChild(target);
                }
            }
        }

        isStarted() {
            return this._.phase === 'started';
        }

        isStopped() {
            return this._.phase !== 'started';
        }

        isFinalized() {
            return this._.phase === 'finalized';
        }


        //----------------------------------------------------------------------------------------------------
        // context property
        //----------------------------------------------------------------------------------------------------        

        setContext(name, value) {
            if (isString(name) === false) {
                console.error('XNode setContext: ' + ERRORS.ARGUMENT);
            } else if (isBasicString(name) === false) {
                console.error('XNode setContext: ' + ERRORS.BASIC_STRING);
            } else {
                this._.context = this._.context ?? new Map();
                this._.context.set(name, value ?? null);
            }
        }

        getContext(name) {
            if (isString(name) === false) {
                console.error('XNode getContext: ' + ERRORS.ARGUMENT);
            } else if (isBasicString(name) === false) {
                console.error('XNode getContext: ' + ERRORS.BASIC_STRING);
            } else {
                let value = undefined;
                let node = this;
                while (node !== null) {
                    if (node._.context?.has(name)) {
                        value = node._.context.get(name);
                        break;
                    }
                    node = node.parent;
                }
                return value;
            }
        }

        //----------------------------------------------------------------------------------------------------
        // key
        //----------------------------------------------------------------------------------------------------
       
        static keyMap = new Map();

        set key(key) {
            if (isString(key) === false) {
                console.error('XNode key: ' + ERRORS.ARGUMENT);
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
                console.error('XNode on: ' + ERRORS.ARGUMENT);
            } else if (isEventType(type) === false) {
                console.error('XNode on: ' + ERRORS.BASIC_STRING);
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
                    const wrapListener = (...args) => xwrap(this, listener, ...args);

                    this._.listeners.get(type).set(listener, wrapListener);
                    this._.nestElement.addEventListener(type, wrapListener, options);
                }
            }
        }

        off(type, listener) {
            if ((type !== undefined && isString(type) === false) || (listener !== undefined && isFunction(listener) === false)) {
                console.error('XNode off: ' + ERRORS.ARGUMENT);
            } else if (type !== undefined && isEventType(type) === false) {
                console.error('XNode off: ' + ERRORS.BASIC_STRING);
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

                    this._.nestElement.removeEventListener(type, wrapListener);
                }
            }
        }

        emit(type, ...args) {
            if (isString(type) === false) {
                console.error('XNode emit: ' + ERRORS.ARGUMENT);
            } else if (this._.phase === 'finalized') {
                console.error('XNode emit: ' + 'This can not be called after finalized.');
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

    //----------------------------------------------------------------------------------------------------
    // iterative update
    //----------------------------------------------------------------------------------------------------

    (() => {
        requestAnimationFrame(ticker);

        function ticker() {
            XNode.updateTime = Date.now();
            XNode.roots.forEach((node) => node._update());
            requestAnimationFrame(ticker);
            XNode.updateCounter++;
        }
    })();


    //----------------------------------------------------------------------------------------------------
    // create element
    //----------------------------------------------------------------------------------------------------

    function createElement(attributes) {

        const element = (() => {
            if (attributes.tag == 'svg') {
                return document.createElementNS('http://www.w3.org/2000/svg', attributes.tag);
            } else {
                return document.createElement(attributes.tag ?? 'div');
            }
        })();

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
        return element;
    }

    //----------------------------------------------------------------------------------------------------
    // util
    //----------------------------------------------------------------------------------------------------

    function isBasicString(value) {
        return isString(value) === true && value.match(/^[A-Za-z0-9_.]*$/) !== null;
    }

    function isEventType(type) {
        const types = type.split(' ').filter((type) => type !== '');
        return types.find((type) => isBasicString(type[0] === '#' ? type.slice(1) : type) === false) === undefined;
    }

    //----------------------------------------------------------------------------------------------------
    // input 
    //----------------------------------------------------------------------------------------------------

    const input = (() => {

        const keyState = {};
        window.addEventListener('keydown', (event) => {
            if (event.repeat === true) return;
            keyState[event.code] = { down: XNode.updateCounter, up: null };
        }, true);
        window.addEventListener('keyup', (event) => {
            if (keyState[event.code]) keyState[event.code].up = XNode.updateCounter;
        }, true);
        
        return {
            getKey(code) {
                if (isString(code) === false) return false;

                let ret = false;
                code.split(' ').forEach((c) => {
                    if (isString(c) && keyState[c]?.up === null) ret = true;
                });
                return ret;
            },
            getKeyDown(code) {
                if (isString(code) === false) return false;

                let ret = false;
                code.split(' ').forEach((c) => {
                    if (isString(c) && keyState[c]?.down === XNode.updateCounter) ret = true;
                });
                return ret;
            },
            getKeyUp(code) {
                if (isString(code) === false) return false;

                let ret = false;
                code.split(' ').forEach((c) => {
                    if (isString(c) && keyState[c]?.up === XNode.updateCounter) ret = true;
                });
                return ret;
            },

            // hasTouch() {
            //     return window.ontouchstart !== undefined && navigator.maxTouchPoints > 0;
            // },
        };
    })();


    //----------------------------------------------------------------------------------------------------
    // audio
    //----------------------------------------------------------------------------------------------------

    const audio = (() => {
        const context = new (window.AudioContext || window.webkitAudioContext)();

        window.addEventListener('touchstart', initialize, true);
        window.addEventListener('mousedown', initialize, true);
        function initialize() {
            new Synth().press(440);
            window.removeEventListener('touchstart', initialize, true);
            window.removeEventListener('mousedown', initialize, true);
        }

        const master = context.createGain();
        master.gain.value = 1.0;
        master.connect(context.destination);

        function Connect(params) {
            Object.keys(params).forEach((key) => {
                const [type, props, ...to] = params[key];
                this[key] = context[`create${type}`]();
                Object.keys(props).forEach((name) => {
                    if (this[key][name]?.value !== undefined) {
                        this[key][name].value = props[name];
                    } else {
                        this[key][name] = props[name];
                    }
                });
            });

            Object.keys(params).forEach((key) => {
                const [type, props, ...to] = params[key];
                
                to.forEach((to) => {
                    let dest = null;
                    if (to.indexOf('.') > 0) {
                        dest = this[to.split('.')[0]][to.split('.')[1]];
                    } else if (this[to]) {
                        dest = this[to];
                    } else if (to === 'master') {
                        dest = master;
                    }
                    this[key].connect(dest);
                });
            });
        }

        class AudioFile {
            static store = new Map();
            constructor(path) {
                this.data = {};
                if (AudioFile.store.has(path)) {
                    this.data = AudioFile.store.get(path);
                } else {
                    this.data.buffer = null;
                    this.data.promise = fetch(path)
                        .then((response) => response.arrayBuffer())
                        .then((response) => context.decodeAudioData(response))
                        .then((response) => this.data.buffer = response)
                        .catch(() => {
                            console.warn(`"${path}" could not be loaded.`);
                        });
                        AudioFile.store.set(path, this.data);
                }

                this.startTime = null;

                this.nodes = new Connect({
                    source: ['BufferSource', {}, 'volume'],
                    volume: ['Gain', { gain: 1.0 }, 'master'],
                });
            }
            isReady() {
                return this.data.buffer ? true : false;
            }
            get promise() {
                return this.data.promise;
            }
            set volume(value) {
                this.nodes.volume.gain.value = value;
            }
            get volume() {
                return this.nodes.volume.gain.value;
            }
            set loop(value) {
                this.nodes.source.loop = value;
            }
            get loop() {
                return this.nodes.source.loop;
            }
            play(offset = 0) {
                if (this.startTime !== null) return;
                if (this.isReady()) {
                    this.startTime = context.currentTime;
                    this.nodes.source.buffer = this.data.buffer;
                    this.nodes.source.playbackRate.value = 1;
                    this.nodes.source.start(context.currentTime, offset / 1000);
                } else {
                    this.promise.then(() =>  this.play());
                }
            }
            stop() {
                if (this.startTime === null) return;
                this.nodes.source.stop(context.currentTime);
                this.startTime = null;
                return (context.currentTime - this.startTime) % this.data.buffer.duration * 1000;
            }
        }
        class Synth {
            constructor({ oscillator = null, filter = null, amp = null } = {}, { bmp = null, reverb = null, delay = null } = {}) {
                this.oscillator = isObject(oscillator) ? oscillator : {};
                this.oscillator.type = setType(this.oscillator.type, ['sine', 'triangle', 'square', 'sawtooth']);
                this.oscillator.envelope = setEnvelope(this.oscillator.envelope, -36, +36);
                this.oscillator.LFO = setLFO(this.oscillator.LFO, 36);

                this.filter = isObject(filter) ? filter : {};
                this.filter.type = setType(this.filter.type, ['lowpass', 'highpass', 'bandpass']);
                this.filter.Q = isNumber(this.filter.cotoff) ? clamp(this.filter.Q, 0, 32) : 0;
                this.filter.cotoff = isNumber(this.filter.cotoff) ? clamp(this.filter.cotoff, 4, 8192) : null;
                this.filter.envelope = setEnvelope(this.filter.envelope, -36, +36);
                this.filter.LFO = setLFO(this.filter.LFO, 36);

                this.amp = isObject(amp) ? amp : {};
                this.amp.envelope = setEnvelope(this.amp.envelope, 0, 1);
                this.amp.LFO = setLFO(this.amp.LFO, 36);

                this.bmp = isNumber(bmp) ? clamp(bmp, 60, 240) : 120;

                this.reverb = isObject(reverb) ? reverb : {};
                this.reverb.time = isNumber(this.reverb.time) ? clamp(this.reverb.time, 0, 2000) : 0.0;
                this.reverb.mix = isNumber(this.reverb.mix) ? clamp(this.reverb.mix, 0, 1.0) : 0.0;

                this.delay = isObject(delay) ? delay : {};
                this.delay.time = isNumber(this.delay.time) ? clamp(this.delay.time, 0, 2000) : 0.0;
                this.delay.feedback = isNumber(this.delay.feedback) ? clamp(this.delay.feedback, 0.0, 0.9) : 0.0;
                this.delay.mix = isNumber(this.delay.mix) ? clamp(this.delay.mix, 0.0, 1.0) : 0.0;

                function setType(type, list, value = 0) {
                    return list.includes(type) ? type : list[value];
                }

                function setEnvelope(envelope, minAmount, maxAmount) {
                    if (isObject(envelope) === false) return null;
                    envelope.amount = isNumber(envelope.amount) ? clamp(envelope.amount, minAmount, maxAmount) : 0;
                    envelope.ADSR = Array.isArray(envelope.ADSR) ? envelope.ADSR : [];
                    envelope.ADSR[0] = isNumber(envelope.ADSR[0]) ? clamp(envelope.ADSR[0], 0, 8000) : 0;
                    envelope.ADSR[1] = isNumber(envelope.ADSR[1]) ? clamp(envelope.ADSR[1], 0, 8000) : 0;
                    envelope.ADSR[2] = isNumber(envelope.ADSR[2]) ? clamp(envelope.ADSR[2], 0, 1) : 0;
                    envelope.ADSR[3] = isNumber(envelope.ADSR[3]) ? clamp(envelope.ADSR[3], 0, 8000) : 0;
                    return envelope;
                }

                function setLFO(LFO, maxAmount) {
                    if (isObject(LFO) === false) return null;
                    LFO.amount = isNumber(LFO.amount) ? clamp(LFO.amount, 0, maxAmount): 0;
                    LFO.type = setType(LFO.type, ['sine', 'triangle', 'square', 'sawtooth']);
                    LFO.rate = clamp(LFO.rate, 1, 128);
                    return LFO;
                }
            }
        
            static keymap = {
                'A0': 27.500, 'A#0': 29.135, 'B0': 30.868, 
                'C1': 32.703, 'C#1': 34.648, 'D1': 36.708, 'D#1': 38.891, 'E1': 41.203, 'F1': 43.654, 'F#1': 46.249, 'G1': 48.999, 'G#1': 51.913, 'A1': 55.000, 'A#1': 58.270, 'B1': 61.735, 
                'C2': 65.406, 'C#2': 69.296, 'D2': 73.416, 'D#2': 77.782, 'E2': 82.407, 'F2': 87.307, 'F#2': 92.499, 'G2': 97.999, 'G#2': 103.826, 'A2': 110.000, 'A#2': 116.541, 'B2': 123.471,
                'C3': 130.813, 'C#3': 138.591, 'D3': 146.832, 'D#3': 155.563, 'E3': 164.814, 'F3': 174.614, 'F#3': 184.997, 'G3': 195.998, 'G#3': 207.652, 'A3': 220.000, 'A#3': 233.082, 'B3': 246.942,
                'C4': 261.626, 'C#4': 277.183, 'D4': 293.665, 'D#4': 311.127, 'E4': 329.628, 'F4': 349.228, 'F#4': 369.994, 'G4': 391.995, 'G#4': 415.305, 'A4': 440.000, 'A#4': 466.164, 'B4': 493.883,
                'C5': 523.251, 'C#5': 554.365, 'D5': 587.330, 'D#5': 622.254, 'E5': 659.255, 'F5': 698.456, 'F#5': 739.989, 'G5': 783.991, 'G#5': 830.609, 'A5': 880.000, 'A#5': 932.328, 'B5': 987.767,
                'C6': 1046.502, 'C#6': 1108.731, 'D6': 1174.659, 'D#6': 1244.508, 'E6': 1318.510, 'F6': 1396.913, 'F#6': 1479.978, 'G6': 1567.982, 'G#6': 1661.219, 'A6': 1760.000, 'A#6': 1864.655, 'B6': 1975.533,
                'C7': 2093.005, 'C#7': 2217.461, 'D7': 2349.318, 'D#7': 2489.016, 'E7': 2637.020, 'F7': 2793.826, 'F#7': 2959.955, 'G7': 3135.963, 'G#7': 3322.438, 'A7': 3520.000, 'A#7': 3729.310, 'B7': 3951.066,
                'C8': 4186.009,
            };
        
            static notemap = {
                '1m': 4.000, '2n': 2.000, '4n': 1.000, '8n': 0.500, '16n': 0.250, '32n': 0.125,
            };
        
            press(frequency, duration = null, wait = 0.0) {
                frequency = isString(frequency) ? Synth.keymap[frequency] : frequency;

                duration = isString(duration) ? (Synth.notemap[duration] * 60 / this.options.bmp) : (duration !== null ? (duration / 1000) : duration);
                const start = context.currentTime + wait / 1000;
                let stop = null;
                
                const params = {};

                if (this.filter.type && this.filter.cutoff) {
                    params.oscillator = ['Oscillator', {}, 'filter'];
                    params.filter = ['BiquadFilter', {}, 'amp'];
                } else {
                    params.oscillator = ['Oscillator', {}, 'amp'];
                }
                params.amp = ['Gain', { gain: 0.0 }, 'target'];
                params.target = ['Gain', { gain: 1.0 }, 'master'];

                if (this.reverb.time > 0.0 && this.reverb.mix > 0.0) {
                    params.amp.push('convolver');
                    params.convolver = ['Convolver', { buffer: impulseResponse({ time: this.reverb.time }) }, 'convolverDepth'];
                    params.convolverDepth = ['Gain', { gain: 1.0 }, 'master'];
                }
                if (this.delay.time > 0.0 && this.delay.mix > 0.0) {
                    params.amp.push('delay');
                    params.delay = ['Delay', { }, 'delayDepth', 'delayFeedback'];
                    params.delayDepth = ['Gain', { gain: 1.0 }, 'master'];
                    params.delayFeedback = ['Gain', { gain: this.delay.feedback }, 'delay'];
                }

                if (this.oscillator.LFO) {
                    params.oscillatorLFO = ['Oscillator', {}, 'oscillatorLFODepth'];
                    params.oscillatorLFODepth = ['Gain', {}, 'oscillator.frequency'];
                }
                if (this.filter.LFO) {
                    params.filterLFO = ['Oscillator', {}, 'filterLFODepth'];
                    params.filterLFODepth = ['Gain', {}, 'filter.frequency'];
                }
                if (this.amp.LFO) {
                    params.ampLFO = ['Oscillator', {}, 'ampLFODepth'];
                    params.ampLFODepth = ['Gain', {}, 'amp.gain'];
                }

                const nodes = new Connect(params);
        
                nodes.oscillator.type = this.oscillator.type;
                nodes.oscillator.frequency.value = clamp(frequency, 10.0, 5000.0);
                
                if (this.filter.type && this.filter.cutoff) {
                    nodes.filter.type = this.filter.type;
                    nodes.filter.frequency.value = this.filter.cutoff;
                }
                if (this.reverb.time > 0.0 && this.reverb.mix > 0.0) {
                    nodes.target.gain.value *= (1.0 - this.reverb.mix);
                    nodes.convolverDepth.gain.value *= this.reverb.mix;
                }
                if (this.delay.time > 0.0 && this.delay.mix > 0.0) {
                    console.log(this.delay.time / 1000);
                    nodes.delay.delayTime.value = this.delay.time / 1000;
                    nodes.target.gain.value *= (1.0 - this.delay.mix);
                    nodes.delayDepth.gain.value *= this.delay.mix;
                }

                {
                    if (this.oscillator.LFO) {
                        nodes.oscillatorLFODepth.gain.value = frequency * (Math.pow(2.0, this.oscillator.LFO.amount / 12.0) - 1.0);
                        nodes.oscillatorLFO.type = this.oscillator.LFO.type;
                        nodes.oscillatorLFO.frequency.value = this.oscillator.LFO.rate;
                        nodes.oscillatorLFO.start(start);
                    }
                    if (this.filter.LFO) {
                        nodes.filterLFODepth.gain.value = frequency * (Math.pow(2.0, this.filter.LFO.amount / 12.0) - 1.0);
                        nodes.filterLFO.type = this.filter.LFO.type;
                        nodes.filterLFO.frequency.value = this.filter.LFO.rate;
                        nodes.filterLFO.start(start);
                    }
                    if (this.amp.LFO) {
                        nodes.ampLFODepth.gain.value = this.amp.LFO.amount;
                        nodes.ampLFO.type = this.amp.LFO.type;
                        nodes.ampLFO.frequency.value = this.amp.LFO.rate;
                        nodes.ampLFO.start(start);
                    }

                    if (this.oscillator.envelope) {
                        const amount = frequency * (Math.pow(2.0, this.oscillator.envelope.amount / 12.0) - 1.0);
                        startEnvelope(nodes.oscillator.frequency, frequency, amount, this.oscillator.envelope.ADSR);
                    }
                    if (this.filter.envelope) {
                        const amount = this.filter.cutoff * (Math.pow(2.0, this.filter.envelope.amount / 12.0) - 1.0);
                        startEnvelope(nodes.filter.frequency, this.filter.cutoff, amount, this.filter.envelope.ADSR);
                    }
                    if (this.amp.envelope) {
                        startEnvelope(nodes.amp.gain, 0.0, this.amp.envelope.amount, this.amp.envelope.ADSR);
                    }

                    nodes.oscillator.start(start);
                }
                if (duration !== null) {
                    release.call(this);
                }

                function release() {
                    duration = duration ?? (context.currentTime - start);
                    if (this.amp.envelope) {
                        const ADSR = this.amp.envelope.ADSR;
                        const adsr = [ADSR[0] / 1000, ADSR[1] / 1000, ADSR[2], ADSR[3] / 1000];
                        const rate = adsr[0] === 0.0 ? 1.0 : Math.min(duration / adsr[0], 1.0);
                        stop = start + Math.max((adsr[0] + adsr[1]) * rate, duration) + adsr[3];
                    } else {
                        stop = start + duration;
                    }

                    if (this.oscillator.LFO) {
                        nodes.oscillatorLFO.stop(stop);
                    }
                    if (this.amp.LFO) {
                        nodes.ampLFO.stop(stop);
                    }

                    if (this.oscillator.envelope) {
                        const amount = frequency * (Math.pow(2.0, this.oscillator.envelope.amount / 12.0) - 1.0);
                        stopEnvelope(nodes.oscillator.frequency, frequency, amount, this.oscillator.envelope.ADSR);
                    }
                    if (this.filter.envelope) {
                        const amount = this.filter.cutoff * (Math.pow(2.0, this.filter.envelope.amount / 12.0) - 1.0);
                        stopEnvelope(nodes.filter.frequency, this.filter.cutoff, amount, this.filter.envelope.ADSR);
                    }
                    if (this.amp.envelope) {
                        stopEnvelope(nodes.amp.gain, 0.0, this.amp.envelope.amount, this.amp.envelope.ADSR);
                    }

                    nodes.oscillator.stop(stop);
                }

                function startEnvelope(param, base, amount, ADSR) {
                    const adsr = [ADSR[0] / 1000, ADSR[1] / 1000, ADSR[2], ADSR[3] / 1000];
                    param.value = base;
                    param.setValueAtTime(base, start);
                    param.linearRampToValueAtTime(base + amount, start + adsr[0]);
                    param.linearRampToValueAtTime(base + amount * adsr[2], start + (adsr[0] + adsr[1]));
                }
                function stopEnvelope(param, base, amount, ADSR) {
                    const adsr = [ADSR[0] / 1000, ADSR[1] / 1000, ADSR[2], ADSR[3] / 1000];
                    const rate = adsr[0] === 0.0 ? 1.0 : Math.min(duration / adsr[0], 1.0);

                    if (rate < 1.0) {
                        param.cancelScheduledValues(start);
                        param.setValueAtTime(base, start);
                        param.linearRampToValueAtTime(base + amount * rate, start + adsr[0] * rate);
                        param.linearRampToValueAtTime(base + amount * rate * adsr[2], start + (adsr[0] + adsr[1]) * rate);
                    }
                    param.linearRampToValueAtTime(base + amount * rate * adsr[2], start + Math.max((adsr[0] + adsr[1]) * rate, duration));
                    param.linearRampToValueAtTime(base, start + Math.max((adsr[0] + adsr[1]) * rate, duration) + adsr[3]);
                }

                return {
                    release: release.bind(this),
                }
            }
        }
        function impulseResponse({ time, decay = 2.0 }) {
            const length = context.sampleRate * time / 1000;
            const impulse = context.createBuffer(2, length, context.sampleRate);
        
            const ch0 = impulse.getChannelData(0);
            const ch1 = impulse.getChannelData(1);
            for (let i = 0; i < length; i++) {
                ch0[i] = (2 * Math.random() - 1) * Math.pow(1 - i / length, decay);
                ch1[i] = (2 * Math.random() - 1) * Math.pow(1 - i / length, decay);
            }
            return impulse;
        }
        
        return {
            get context() {
                return context;
            },
            create(props, effects) {
                return new Synth(props, effects);
            },
            load(path) {
                return new AudioFile(path);
            }
        };
    })();

    var util = {
        __proto__: null,
        input: input,
        audio: audio
    };

    //----------------------------------------------------------------------------------------------------
    // screen
    //----------------------------------------------------------------------------------------------------

    function Screen(node, { width = 640, height = 480, objectFit = 'contain', pixelated = false } = {}) {
        node.nestElement({ style: 'position: relative; width: 100%; height: 100%; overflow: hidden; user-select: none;' });
        node.nestElement({ style: 'position: absolute; inset: 0; margin: auto; user-select: none;' });
        node.nestElement({ style: 'position: relative; width: 100%; height: 100%; user-select: none;' });
        const absolute = node.element.parentElement;

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

    //----------------------------------------------------------------------------------------------------
    // transition
    //----------------------------------------------------------------------------------------------------

    function Transition(node, callback, interval = 1000) {

        return {
            update(time) {
                const value = time / interval;
                xwrap(node.parent, callback, Math.min(1.0, value));
                if (value >= 1.0) node.finalize();
            }
        }
    }

    //----------------------------------------------------------------------------------------------------
    // drag event
    //----------------------------------------------------------------------------------------------------

    function DragEvent(node) {
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
            node.emit(type, event, { type, position, });
            window.addEventListener('pointermove', move);
            window.addEventListener('pointerup', up);
        }    function move(event) {
            const position = getPosition(event, id);
            if (position === null) return;

            const delta = { x: position.x - current.x, y: position.y - current.y };
            current = position;

            const type = 'move';
            node.emit(type, event, { type, position, delta, });
        }    function up(event) {
            const position = getPosition(event, id);
            if (position === null) return;
            
            const type = 'up';
            node.emit(type, event, { type, position, });
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

            const rect = node.element.getBoundingClientRect();
           
            let scaleX = 1.0;
            let scaleY = 1.0;
            if (node.element.tagName.toLowerCase() === 'canvas' && isNumber(node.element.width) && isNumber(node.element.height)) {
                scaleX = node.element.width / rect.width;
                scaleY = node.element.height / rect.height;
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

    //----------------------------------------------------------------------------------------------------
    // d-pad
    //----------------------------------------------------------------------------------------------------

    function DPad(node, { size = 130, fill = '#FFF', fillOpacity = 0.8, stroke = '#000', strokeOpacity = 0.8, strokeWidth = 2 } = {}) {
        node.nestElement({ style: `position: relative; width: ${size}px; height: ${size}px; cursor: pointer; overflow: hidden; user-select: none;`, });

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

            node.emit(type, event, { type, vector });
        });

        drag.on('up', (event, { type }) => {
            for(let i = 0; i < 4; i++) {
                targets[i].element.style.filter = '';
            }
            const vector = { x: 0, y: 0 };
            node.emit(type, event, { type, vector });
        });
    }

    //----------------------------------------------------------------------------------------------------
    // analog stick
    //----------------------------------------------------------------------------------------------------

    function AnalogStick(node, { size = 130, fill = '#FFF', fillOpacity = 0.8, stroke = '#000', strokeOpacity = 0.8, strokeWidth = 2 } = {}) {
        node.nestElement({ style: `position: relative; width: ${size}px; height: ${size}px; cursor: pointer; user-select: none; overflow: hidden;`, });

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
            node.emit(type, event, { type, vector });
            [target.element.style.left, target.element.style.top] = [vector.x * size / 4 + 'px', vector.y * size / 4 + 'px'];
        });

        drag.on('up', (event, { type }) => {
            target.element.style.filter = '';

            const vector = { x: 0, y: 0 };
            node.emit(type, event, { type, vector });
            [target.element.style.left, target.element.style.top] = [vector.x * size / 4 + 'px', vector.y * size / 4 + 'px'];
        });
    }


    //----------------------------------------------------------------------------------------------------
    // circle button
    //----------------------------------------------------------------------------------------------------

    function CircleButton(node, { size = 80, fill = '#FFF', fillOpacity = 0.8, stroke = '#000', strokeOpacity = 0.8, strokeWidth = 2 } = {}) {
        node.nestElement({ style: `position: relative; width: ${size}px; height: ${size}px; user-select: none;`, });

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
            node.emit(type, event, { type });

            window.addEventListener('pointerup', up);
        }
        function up(event) {
            target.element.style.filter = '';
            const type = 'up';
            node.emit(type, event, { type });

            window.removeEventListener('pointerup', up);
        }

        return {
            finalize() {
                window.removeEventListener('pointerup', up);
            },
        }
    }

    var components = {
        __proto__: null,
        Screen: Screen,
        Transition: Transition,
        DragEvent: DragEvent,
        DPad: DPad,
        AnalogStick: AnalogStick,
        CircleButton: CircleButton,
        xutil: util
    };

    exports.xcomponents = components;
    exports.xfind = xfind;
    exports.xnew = xnew;
    exports.xtimer = xtimer$1;
    exports.xutil = util;

}));
