class MapSet extends Map {
    has(key, value) {
        var _a, _b;
        if (value === undefined) {
            return super.has(key);
        }
        else {
            return (_b = (_a = super.get(key)) === null || _a === void 0 ? void 0 : _a.has(value)) !== null && _b !== void 0 ? _b : false;
        }
    }
    add(key, value) {
        let set = super.get(key);
        if (set === undefined) {
            set = new Set();
            super.set(key, set);
        }
        set.add(value);
        return this;
    }
    keys(key) {
        var _a, _b;
        if (key === undefined) {
            return super.keys();
        }
        else {
            return (_b = (_a = super.get(key)) === null || _a === void 0 ? void 0 : _a.values()) !== null && _b !== void 0 ? _b : [].values();
        }
    }
    delete(key, value) {
        if (value === undefined) {
            return super.delete(key);
        }
        else {
            const set = super.get(key);
            if (set === undefined) {
                return false;
            }
            else {
                const ret = set.delete(value);
                if (set.size === 0) {
                    super.delete(key);
                }
                return ret;
            }
        }
    }
}
class MapMap extends Map {
    has(key1, key2) {
        var _a, _b;
        if (key2 === undefined) {
            return super.has(key1);
        }
        else {
            return (_b = (_a = super.get(key1)) === null || _a === void 0 ? void 0 : _a.has(key2)) !== null && _b !== void 0 ? _b : false;
        }
    }
    set(key1, key2OrValue, value) {
        if (value === undefined) {
            super.set(key1, key2OrValue);
        }
        else {
            let inner = super.get(key1);
            if (inner === undefined) {
                inner = new Map();
                super.set(key1, inner);
            }
            inner.set(key2OrValue, value);
        }
        return this;
    }
    get(key1, key2) {
        var _a;
        if (key2 === undefined) {
            return super.get(key1);
        }
        else {
            return (_a = super.get(key1)) === null || _a === void 0 ? void 0 : _a.get(key2);
        }
    }
    keys(key1) {
        var _a, _b;
        if (key1 === undefined) {
            return super.keys();
        }
        else {
            return (_b = (_a = super.get(key1)) === null || _a === void 0 ? void 0 : _a.keys()) !== null && _b !== void 0 ? _b : [].values();
        }
    }
    delete(key1, key2) {
        if (key2 === undefined) {
            return super.delete(key1);
        }
        else {
            const inner = super.get(key1);
            if (inner === undefined) {
                return false;
            }
            else {
                const ret = inner.delete(key2);
                if (inner.size === 0) {
                    super.delete(key1);
                }
                return ret;
            }
        }
    }
}

class Ticker {
    constructor(callback, fps = 60) {
        this.cancel = null;
        const interval = 1000 / fps;
        let previous = Date.now();
        let next = previous + interval;
        if (typeof requestAnimationFrame !== 'undefined') {
            const tolerance = interval * 0.1;
            const tick = () => {
                const now = Date.now();
                if (now >= next - tolerance) {
                    callback(now - previous);
                    previous = now;
                    next += interval;
                    if (next < now) {
                        next = now + interval;
                    }
                }
                id = requestAnimationFrame(tick);
            };
            let id = requestAnimationFrame(tick);
            this.cancel = () => cancelAnimationFrame(id);
        }
        else {
            let id;
            const tick = () => {
                const now = Date.now();
                callback(now - previous);
                previous = now;
                next += interval;
                if (next < now) {
                    next = now + interval;
                }
                id = setTimeout(tick, next - now);
            };
            id = setTimeout(tick, interval);
            this.cancel = () => clearTimeout(id);
        }
    }
    clear() {
        if (this.cancel !== null) {
            this.cancel();
            this.cancel = null;
        }
    }
}
function ease(p, easing) {
    switch (easing) {
        case 'ease-out':
            return Math.pow(1.0 - Math.pow(1.0 - p, 2.0), 0.5);
        case 'ease-in':
            return Math.pow(1.0 - Math.pow(1.0 - p, 0.5), 2.0);
        case 'ease':
            return ((s) => s * s * (3 - 2 * s))(p ** 0.7);
        case 'ease-in-out':
            return p * p * (3 - 2 * p);
        default:
            return p;
    }
}
class Timer {
    constructor(timeout, transition, duration, easing) {
        var _a;
        this.timeout = timeout;
        this.transition = transition;
        this.duration = duration;
        this.easing = easing;
        this.id = null;
        this.startTime = 0.0;
        this.processed = 0.0;
        this.cleared = false;
        this.ticker = null;
        this.visibilityListener = () => document.hidden === false ? this.start() : this.stop();
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', this.visibilityListener);
        }
        (_a = this.transition) === null || _a === void 0 ? void 0 : _a.call(this, 0.0);
        this.start();
    }
    clear() {
        var _a;
        this.cleared = true;
        if (this.id !== null) {
            clearTimeout(this.id);
            this.id = null;
        }
        if (typeof document !== 'undefined') {
            document.removeEventListener('visibilitychange', this.visibilityListener);
        }
        (_a = this.ticker) === null || _a === void 0 ? void 0 : _a.clear();
        this.ticker = null;
    }
    start() {
        if (this.cleared === false && this.id === null) {
            this.id = setTimeout(() => {
                var _a, _b;
                this.id = null;
                this.clear();
                (_a = this.transition) === null || _a === void 0 ? void 0 : _a.call(this, 1.0);
                (_b = this.timeout) === null || _b === void 0 ? void 0 : _b.call(this);
            }, this.duration - this.processed);
            this.startTime = Date.now();
            if (this.duration > 0.0) {
                this.ticker = new Ticker(() => {
                    var _a;
                    const elapsed = this.processed + (Date.now() - this.startTime);
                    const p = Math.min(elapsed / this.duration, 1.0);
                    (_a = this.transition) === null || _a === void 0 ? void 0 : _a.call(this, ease(p, this.easing));
                });
            }
        }
    }
    stop() {
        var _a;
        if (this.id !== null) {
            this.processed += Date.now() - this.startTime;
            clearTimeout(this.id);
            this.id = null;
            (_a = this.ticker) === null || _a === void 0 ? void 0 : _a.clear();
            this.ticker = null;
        }
    }
}

function isDomElement(value) {
    return (typeof HTMLElement !== 'undefined' && value instanceof HTMLElement) || (typeof SVGElement !== 'undefined' && value instanceof SVGElement);
}
function isElementDef(value) {
    return typeof value === 'object' && value !== null && isDomElement(value) === false && typeof value.tag === 'string';
}
const tagName = /^[A-Za-z][A-Za-z0-9]*$/;
const svgCamelAttributes = new Set([
    'attributeName', 'attributeType', 'baseFrequency', 'baseProfile', 'calcMode', 'clipPathUnits',
    'diffuseConstant', 'edgeMode', 'filterUnits', 'glyphRef', 'gradientTransform', 'gradientUnits',
    'kernelMatrix', 'kernelUnitLength', 'keyPoints', 'keySplines', 'keyTimes', 'lengthAdjust',
    'limitingConeAngle', 'markerHeight', 'markerUnits', 'markerWidth', 'maskContentUnits', 'maskUnits',
    'numOctaves', 'pathLength', 'patternContentUnits', 'patternTransform', 'patternUnits',
    'pointsAtX', 'pointsAtY', 'pointsAtZ', 'preserveAlpha', 'preserveAspectRatio', 'primitiveUnits',
    'refX', 'refY', 'repeatCount', 'repeatDur', 'requiredExtensions', 'specularConstant',
    'specularExponent', 'spreadMethod', 'startOffset', 'stdDeviation', 'stitchTiles', 'surfaceScale',
    'systemLanguage', 'tableValues', 'targetX', 'targetY', 'textLength', 'viewBox',
    'xChannelSelector', 'yChannelSelector', 'zoomAndPan',
]);
function svgAttributeName(key) {
    if (svgCamelAttributes.has(key)) {
        return key;
    }
    else {
        return key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
    }
}
function buildTag(tag) {
    if (isElementDef(tag) === true) {
        if (tagName.test(tag.tag) === false) {
            throw new Error(`xnew: invalid tag name "${tag.tag}".`);
        }
        const escape = (value) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
        let attributes = '';
        const members = [];
        for (const [key, value] of Object.entries(tag)) {
            if (key === 'tag' || value === undefined || value === null || value === false) ;
            else if (key === 'className') {
                attributes += ` class="${escape(String(value))}"`;
            }
            else if (key === 'style') {
                attributes += ` style="${escape(String(value))}"`;
            }
            else {
                members.push([key, value]);
            }
        }
        return { text: `<${tag.tag}${attributes}></${tag.tag}>`, members };
    }
    else {
        const match = typeof tag === 'string' ? tag.match(/<((\w+)[^>]*?)\/?>/) : null;
        if (match !== null) {
            return { text: `<${match[1]}></${match[2]}>`, members: [] };
        }
        else {
            throw new Error(`xnew.nest: invalid tag string [${tag}]`);
        }
    }
}
const factories = new Map();
function attach(target, type, execute, options) {
    let initialized = false;
    const id = setTimeout(() => { initialized = true; target.addEventListener(type, execute, options); }, 0);
    return () => {
        if (initialized === false) {
            clearTimeout(id);
        }
        else {
            target.removeEventListener(type, execute);
        }
    };
}
function getPointerPosition(element, event) {
    const rect = element.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}
class EventBinder {
    constructor() {
        this.map = new MapMap();
    }
    add(element, type, listener, options) {
        const props = { element, type, listener, options };
        const factory = factories.get(type);
        const keyboard = type.match(/^(window|document)\.(keydown|keyup)(?:\.([A-Za-z0-9]+))?$/);
        let finalize;
        if (factory !== undefined) {
            finalize = factory(props);
        }
        else if (keyboard !== null) {
            finalize = keyboardEvent(keyboard, props);
        }
        else {
            let target = element;
            let name = type;
            if (type.startsWith('window.')) {
                target = window;
                name = type.substring('window.'.length);
            }
            else if (type.startsWith('document.')) {
                target = document;
                name = type.substring('document.'.length);
            }
            finalize = attach(target, name, (event) => listener({ event }), options);
        }
        this.map.set(type, listener, finalize);
    }
    remove(type, listener) {
        const finalize = this.map.get(type, listener);
        if (finalize) {
            finalize();
            this.map.delete(type, listener);
        }
    }
}
function defineEvent(types, factory) {
    types.forEach((type) => factories.set(type, factory));
}
defineEvent(['change', 'input'], (props) => {
    return attach(props.element, props.type, (event) => {
        let value = null;
        if (event.target.type === 'checkbox') {
            value = event.target.checked;
        }
        else if (event.target.type === 'range' || event.target.type === 'number') {
            value = parseFloat(event.target.value);
        }
        else {
            value = event.target.value;
        }
        props.listener({ event, value });
    }, props.options);
});
defineEvent(['click', 'pointerdown', 'pointermove', 'pointerup', 'pointerover', 'pointerout'], (props) => {
    return attach(props.element, props.type, (event) => {
        props.listener({ event, position: getPointerPosition(props.element, event) });
    }, props.options);
});
defineEvent(['click.outside', 'pointerdown.outside', 'pointermove.outside', 'pointerup.outside'], (props) => {
    return attach(document, props.type.split('.')[0], (event) => {
        if (props.element.contains(event.target) === false) {
            props.listener({ event, position: getPointerPosition(props.element, event) });
        }
    }, props.options);
});
defineEvent(['wheel'], (props) => {
    return attach(props.element, props.type, (event) => {
        props.listener({ event, delta: { x: event.deltaX, y: event.deltaY } });
    }, props.options);
});
defineEvent(['resize'], (props) => {
    const observer = new ResizeObserver(() => props.listener({}));
    observer.observe(props.element);
    return () => observer.unobserve(props.element);
});
defineEvent(['dragstart', 'dragmove', 'dragend'], (props) => {
    let finalizers = [];
    const remove = () => { finalizers.forEach((finalize) => finalize()); finalizers = []; };
    const pointerdown = attach(props.element, 'pointerdown', (event) => {
        if (finalizers.length === 0) {
            const id = event.pointerId;
            let previous = getPointerPosition(props.element, event);
            const track = (kind) => (event) => {
                if (event.pointerId === id) {
                    const position = getPointerPosition(props.element, event);
                    if (props.type === kind) {
                        const delta = kind === 'dragmove' ? { x: position.x - previous.x, y: position.y - previous.y } : { x: 0, y: 0 };
                        props.listener({ event, position, delta });
                    }
                    previous = position;
                    if (kind === 'dragend') {
                        remove();
                    }
                }
            };
            finalizers = [
                attach(window, 'pointermove', track('dragmove'), props.options),
                attach(window, 'pointerup', track('dragend'), props.options),
                attach(window, 'pointercancel', track('dragend'), props.options),
            ];
            track('dragstart')(event);
        }
    }, props.options);
    return () => {
        pointerdown();
        remove();
    };
});
defineEvent(['window.keydown.arrow', 'window.keyup.arrow', 'window.keydown.wasd', 'window.keyup.wasd'], (props) => {
    const VECTOR_CODES = {
        arrow: { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown' },
        wasd: { left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS' },
    };
    const [, variant, name] = props.type.split('.');
    const codes = VECTOR_CODES[name];
    const keymap = {};
    const targets = [codes.left, codes.right, codes.up, codes.down];
    const vector = () => ({
        x: (keymap[codes.left] ? -1 : 0) + (keymap[codes.right] ? +1 : 0),
        y: (keymap[codes.up] ? -1 : 0) + (keymap[codes.down] ? +1 : 0),
    });
    const bind = (kind) => attach(window, kind, (event) => {
        if (kind === 'keyup' || !event.repeat) {
            keymap[event.code] = kind === 'keydown' ? 1 : 0;
            if (kind === variant && targets.includes(event.code)) {
                props.listener({ event, vector: vector() });
            }
        }
    }, props.options);
    const finalizers = [bind('keydown'), bind('keyup')];
    return () => finalizers.forEach((finalize) => finalize());
});
function keyboardEvent(matched, props) {
    const [, scope, variant, rawKey] = matched;
    const key = rawKey === null || rawKey === void 0 ? void 0 : rawKey.toLowerCase();
    const target = scope === 'document' ? document : window;
    const codes = {
        space: 'Space', enter: 'Enter', escape: 'Escape', esc: 'Escape', tab: 'Tab',
        up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight',
    };
    'abcdefghijklmnopqrstuvwxyz'.split('').forEach((c) => codes[c] = 'Key' + c.toUpperCase());
    '0123456789'.split('').forEach((c) => codes[c] = 'Digit' + c);
    const code = key !== undefined ? codes[key] : undefined;
    return attach(target, variant, (event) => {
        var _a, _b;
        const matches = key === undefined || (code !== undefined ? event.code === code : (((_a = event.code) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === key || ((_b = event.key) === null || _b === void 0 ? void 0 : _b.toLowerCase()) === key));
        if (!event.repeat && matches) {
            props.listener({ event });
        }
    }, props.options);
}

class Unit {
    constructor(parent = null) {
        var _a, _b;
        parent === null || parent === void 0 ? void 0 : parent._.children.push(this);
        const baseContext = (_a = parent === null || parent === void 0 ? void 0 : parent._.currentContext) !== null && _a !== void 0 ? _a : { previous: null };
        let baseElement;
        if (parent !== null) {
            baseElement = parent._.currentElement;
        }
        else if ((_b = globalThis.document) === null || _b === void 0 ? void 0 : _b.body) {
            baseElement = globalThis.document.body;
        }
        else {
            baseElement = null;
        }
        this._ = {
            parent,
            phase: 'invoked',
            protected: false,
            currentElement: baseElement,
            currentContext: baseContext,
            currentComponent: null,
            lastSnapshot: null,
            children: [],
            nestElements: [],
            promises: [],
            Components: [],
            listeners: new MapMap(),
            defines: {},
            systems: { update: [], finalize: [] },
            events: new EventBinder(),
            key: null,
        };
    }
    static create(parent, ...args) {
        const unit = new Unit(parent);
        Unit.initialize(unit, ...args);
        return unit;
    }
    static initialize(unit, ...args) {
        var _a;
        if (isDomElement(args[0])) {
            unit._.currentElement = args.shift();
        }
        else if (typeof args[0] === 'string' || isElementDef(args[0]) === true) {
            Unit.nest(unit, args.shift());
        }
        const Component = args[0];
        const props = args[1];
        let baseComponent;
        if (typeof Component === 'function') {
            baseComponent = Component;
        }
        else if (typeof Component === 'string' || typeof Component === 'number') {
            baseComponent = (unit) => { unit.element.textContent = Component.toString(); };
        }
        else {
            baseComponent = (unit) => { };
        }
        unit._.key = (_a = props === null || props === void 0 ? void 0 : props.key) !== null && _a !== void 0 ? _a : null;
        const backup = Unit.currentUnit;
        Unit.currentUnit = unit;
        Unit.extend(unit, baseComponent, props);
        if (unit._.phase === 'invoked') {
            unit._.phase = 'initialized';
        }
        unit._.lastSnapshot = Unit.snapshot(unit);
        Unit.currentUnit = backup;
    }
    get parent() {
        return this._.parent;
    }
    get element() {
        return this._.currentElement;
    }
    finalize() {
        var _a;
        if (this._.phase !== 'finalized' && this._.phase !== 'finalizing') {
            this._.phase = 'finalizing';
            [...this._.children].reverse().forEach((child) => child.finalize());
            [...this._.systems.finalize].reverse().forEach(({ execute }) => execute());
            (_a = Unit.owner2targets.get(this)) === null || _a === void 0 ? void 0 : _a.forEach((target) => {
                [...target._.listeners.keys(), 'update', 'finalize'].forEach((type) => Unit.off(target, this, type));
            });
            Unit.owner2targets.delete(this);
            [...this._.listeners.keys(), 'update', 'finalize'].forEach((type) => Unit.off(this, null, type));
            [...this._.nestElements].reverse().forEach((element) => element.remove());
            this._.Components.forEach((Component) => Unit.component2units.delete(Component, this));
            const contexts = Unit.unit2Contexts.get(this);
            contexts === null || contexts === void 0 ? void 0 : contexts.forEach((context) => {
                let temp = context.previous;
                while (temp !== null) {
                    if (contexts.has(temp) === false && temp.key !== undefined) {
                        context.previous = temp;
                        context.key = undefined;
                        context.value = undefined;
                        break;
                    }
                    temp = temp.previous;
                }
            });
            Unit.unit2Contexts.delete(this);
            this._.currentContext = { previous: null };
            Object.keys(this._.defines).forEach((key) => delete this[key]);
            this._.defines = {};
            if (this._.parent) {
                this._.parent._.children = this._.parent._.children.filter((u) => u !== this);
            }
            this._.phase = 'finalized';
        }
    }
    static nest(unit, tag, textContent) {
        const { text, members } = buildTag(tag);
        unit._.currentElement.insertAdjacentHTML('beforeend', text);
        const element = unit._.currentElement.children[unit._.currentElement.children.length - 1];
        unit._.currentElement = element;
        if (textContent !== undefined) {
            element.textContent = textContent;
        }
        unit._.nestElements.push(element);
        for (const [key, value] of members) {
            if (element instanceof SVGElement) {
                element.setAttribute(svgAttributeName(key), String(value));
            }
            else if (key in element) {
                element[key] = value;
            }
            else {
                element.setAttribute(key, String(value));
            }
        }
        return element;
    }
    static extend(unit, Component, props) {
        var _a;
        const backupComponent = unit._.currentComponent;
        unit._.currentComponent = Component;
        if (unit._.parent !== null) {
            Unit.addContext(unit._.parent, unit, Component, unit);
        }
        Unit.addContext(unit, unit, Component, unit);
        const defines = (_a = Component(unit, props !== null && props !== void 0 ? props : {})) !== null && _a !== void 0 ? _a : {};
        unit._.currentComponent = backupComponent;
        Unit.component2units.add(Component, unit);
        unit._.Components.push(Component);
        Object.keys(defines).forEach((key) => {
            if (unit[key] !== undefined && unit._.defines[key] === undefined) {
                throw new Error(`The property "${key}" already exists.`);
            }
            const descriptor = Object.getOwnPropertyDescriptor(defines, key);
            const wrapper = { configurable: true, enumerable: true };
            const snapshot = Unit.snapshot(unit);
            if ((descriptor === null || descriptor === void 0 ? void 0 : descriptor.get) || (descriptor === null || descriptor === void 0 ? void 0 : descriptor.set)) {
                if (descriptor === null || descriptor === void 0 ? void 0 : descriptor.get)
                    wrapper.get = (...args) => Unit.scope(snapshot, descriptor.get, ...args);
                if (descriptor === null || descriptor === void 0 ? void 0 : descriptor.set)
                    wrapper.set = (...args) => Unit.scope(snapshot, descriptor.set, ...args);
            }
            else if (typeof (descriptor === null || descriptor === void 0 ? void 0 : descriptor.value) === 'function') {
                wrapper.value = (...args) => Unit.scope(snapshot, descriptor.value, ...args);
            }
            else {
                throw new Error(`Only function properties can be defined as Component defines. [${key}]`);
            }
            Object.defineProperty(unit._.defines, key, wrapper);
            Object.defineProperty(unit, key, wrapper);
        });
        let clone = {};
        Object.defineProperties(clone, Object.getOwnPropertyDescriptors(unit._.defines));
        return clone;
    }
    static update(unit, delta = 0) {
        if (unit._.phase === 'initialized') {
            unit._.children.forEach((child) => Unit.update(child, delta));
            [...unit._.systems.update].forEach((entry) => entry.execute({ count: entry.count++, delta }));
        }
    }
    static get current() {
        if (Unit.engineRoot === undefined) {
            Unit.reset();
        }
        return Unit.currentUnit;
    }
    static reset() {
        var _a;
        (_a = Unit.engineRoot) === null || _a === void 0 ? void 0 : _a.finalize();
        Unit.currentUnit = Unit.engineRoot = Unit.create(null);
        const ticker = new Ticker((delta) => {
            Unit.update(Unit.engineRoot, delta);
        });
        Unit.engineRoot.on('finalize', () => ticker.clear());
    }
    static scope(snapshot, func, ...args) {
        if (snapshot.unit._.phase === 'finalized') {
            return;
        }
        const currentUnit = Unit.currentUnit;
        const backup = Unit.snapshot(snapshot.unit);
        try {
            Unit.currentUnit = snapshot.unit;
            snapshot.unit._.currentContext = snapshot.context;
            snapshot.unit._.currentElement = snapshot.element;
            snapshot.unit._.currentComponent = snapshot.Component;
            return func(...args);
        }
        finally {
            Unit.currentUnit = currentUnit;
            snapshot.unit._.currentContext = backup.context;
            snapshot.unit._.currentElement = backup.element;
            snapshot.unit._.currentComponent = backup.Component;
        }
    }
    static snapshot(unit) {
        return { unit, context: unit._.currentContext, element: unit._.currentElement, Component: unit._.currentComponent };
    }
    static addContext(unit, orner, key, value) {
        unit._.currentContext = { previous: unit._.currentContext, key, value };
        Unit.unit2Contexts.add(orner, unit._.currentContext);
    }
    static getContext(unit, key) {
        for (let context = unit._.currentContext; context.previous !== null; context = context.previous) {
            if (context.value === Unit.currentUnit && key === unit._.currentComponent)
                continue;
            if (key === context.key)
                return context.value;
        }
    }
    static ancestors(unit) {
        var _a;
        const ancestors = [];
        for (let u = (_a = unit === null || unit === void 0 ? void 0 : unit._.parent) !== null && _a !== void 0 ? _a : null; u !== null; u = u._.parent)
            ancestors.push(u);
        return ancestors;
    }
    static isVisible(from, current, ancestors) {
        let boundary;
        for (let u = from; u !== null; u = u._.parent) {
            if (u._.protected === true) {
                boundary = u;
                break;
            }
        }
        return boundary === undefined || ancestors.includes(boundary) === true || current === boundary;
    }
    static find(Component, key) {
        var _a;
        const current = Unit.currentUnit;
        const ancestors = Unit.ancestors(current);
        return [...((_a = Unit.component2units.get(Component)) !== null && _a !== void 0 ? _a : [])].filter((unit) => {
            if (key !== undefined && unit._.key !== key) {
                return false;
            }
            return Unit.isVisible(unit._.parent, current, ancestors);
        });
    }
    on(type, listener, options) {
        const types = type.trim().split(/\s+/);
        types.forEach((type) => Unit.on(this, type, listener, options));
    }
    once(type, listener, options) {
        const owner = Unit.currentUnit;
        const types = type.trim().split(/\s+/);
        types.forEach((type) => {
            const wrapper = (props) => {
                Unit.off(this, owner, type, wrapper);
                listener(props);
            };
            Unit.on(this, type, wrapper, options);
        });
    }
    off(type, listener) {
        const types = typeof type === 'string' ? type.trim().split(/\s+/) : [...this._.listeners.keys(), 'update', 'finalize'];
        types.forEach((type) => Unit.off(this, Unit.currentUnit, type, listener));
    }
    static on(unit, type, listener, options) {
        const owner = Unit.currentUnit;
        const snapshot = Unit.snapshot(owner);
        const execute = (props = {}) => {
            Unit.scope(snapshot, listener, Object.assign({ type }, props));
        };
        if (type === 'update' || type === 'finalize') {
            unit._.systems[type].push({ listener, execute, count: 0, owner });
        }
        else if (unit._.listeners.has(type, listener) === false) {
            unit._.listeners.set(type, listener, { execute, owner });
            Unit.type2units.add(type, unit);
            if (/^[A-Za-z]/.test(type) && unit.element !== null) {
                unit._.events.add(unit.element, type, execute, options);
            }
        }
        if (owner !== unit) {
            Unit.owner2targets.add(owner, unit);
        }
    }
    static off(unit, owner, type, listener) {
        var _a, _b;
        const match = (lis, own) => (owner === null || own === owner) && (listener === undefined || lis === listener);
        if (type === 'update' || type === 'finalize') {
            unit._.systems[type] = unit._.systems[type].filter((entry) => match(entry.listener, entry.owner) === false);
        }
        else {
            [...((_b = (_a = unit._.listeners.get(type)) === null || _a === void 0 ? void 0 : _a.entries()) !== null && _b !== void 0 ? _b : [])].forEach(([lis, item]) => {
                if (match(lis, item.owner)) {
                    unit._.listeners.delete(type, lis);
                    if (/^[A-Za-z]/.test(type)) {
                        unit._.events.remove(type, item.execute);
                    }
                }
            });
            if (unit._.listeners.has(type) === false) {
                Unit.type2units.delete(type, unit);
            }
        }
    }
    static emit(unit, type, props = {}) {
        var _a, _b;
        if (type[0] === '+') {
            const ancestors = Unit.ancestors(unit);
            (_a = Unit.type2units.get(type)) === null || _a === void 0 ? void 0 : _a.forEach((target) => {
                var _a;
                if (Unit.isVisible(target, unit, ancestors)) {
                    (_a = target._.listeners.get(type)) === null || _a === void 0 ? void 0 : _a.forEach((item) => item.execute(props));
                }
            });
        }
        else if (type[0] === '-') {
            (_b = unit._.listeners.get(type)) === null || _b === void 0 ? void 0 : _b.forEach((item) => item.execute(props));
        }
    }
}
Unit.unit2Contexts = new MapSet();
Unit.component2units = new MapSet();
Unit.type2units = new MapSet();
Unit.owner2targets = new MapSet();
class UnitPromise {
    constructor(promise, key) {
        this.promise = promise;
        this.key = key;
    }
    chain(method, callback) {
        const snapshot = Unit.snapshot(Unit.currentUnit);
        this.promise = this.promise[method]((...args) => {
            const result = Unit.scope(snapshot, callback, ...args);
            return result instanceof UnitPromise ? result.promise : result;
        });
        return this;
    }
    then(callback) { return this.chain('then', callback); }
    catch(callback) { return this.chain('catch', callback); }
    finally(callback) { return this.chain('finally', callback); }
    static async collect(promises) {
        const values = await Promise.all(promises.map(p => p.promise));
        const out = {};
        promises.forEach((p, i) => {
            if (p.key === undefined) {
                return;
            }
            const matched = p.key.match(/^(.+)\[\]$/);
            if (matched !== null) {
                const name = matched[1];
                if (Array.isArray(out[name]) === false) {
                    out[name] = [];
                }
                out[name].push(values[i]);
            }
            else {
                out[p.key] = values[i];
            }
        });
        return out;
    }
}
class UnitTimer {
    constructor() {
        this.unit = null;
        this.queue = [];
    }
    clear() {
        var _a;
        this.queue = [];
        (_a = this.unit) === null || _a === void 0 ? void 0 : _a.finalize();
        this.unit = null;
    }
    timeout(timeout, duration = 0) {
        return this.execute(timeout, null, duration, 1);
    }
    interval(timeout, duration = 0, iterations = 0) {
        return this.execute(timeout, null, duration, iterations);
    }
    transition(transition, duration = 0, easing) {
        return this.execute(null, transition, duration, 1, easing);
    }
    execute(timeout, transition, duration, iterations, easing) {
        const snapshot = Unit.snapshot(Unit.currentUnit);
        const Component = (unit) => {
            let counter = 0;
            let current = new Timer(onTimeout, onTransition, duration, easing);
            function onTimeout() {
                if (timeout)
                    Unit.scope(snapshot, timeout, { count: counter });
                if (unit._.phase === 'finalized') {
                    return;
                }
                if (iterations <= 0 || counter < iterations - 1) {
                    current = new Timer(onTimeout, onTransition, duration, easing);
                }
                else {
                    unit.finalize();
                }
                counter++;
            }
            function onTransition(value) {
                if (transition)
                    Unit.scope(snapshot, transition, { value });
            }
            unit.on('finalize', () => current.clear());
        };
        if (this.unit === null || this.unit._.phase === 'finalized') {
            this.start(Component);
        }
        else {
            this.queue.push(Component);
        }
        return this;
    }
    start(Component) {
        this.unit = Unit.create(Unit.currentUnit, Component);
        this.unit.on('finalize', () => {
            const owner = Unit.currentUnit;
            if (this.queue.length > 0 && owner._.phase !== 'finalizing' && owner._.phase !== 'finalized') {
                this.start(this.queue.shift());
            }
            else {
                this.queue = [];
            }
        });
    }
}

const registry = new Map();
let counter = 0;
const localName = /^[A-Za-z][A-Za-z0-9_-]*$/;
const layerName = /^[A-Za-z][A-Za-z0-9_-]*(\.[A-Za-z][A-Za-z0-9_-]*)*$/;
const typeName = /^[a-z-]+$/;
const reference = /\$([A-Za-z][A-Za-z0-9_-]*)/g;
function applyCss(unit, defs) {
    var _a;
    if (((_a = globalThis.document) === null || _a === void 0 ? void 0 : _a.head) === undefined) {
        return Object.fromEntries(Object.keys(defs).map((name) => [name, name]));
    }
    const key = JSON.stringify(defs);
    let entry = registry.get(key);
    if (entry === undefined) {
        const id = counter++;
        const names = {};
        for (const name of Object.keys(defs)) {
            if (localName.test(name) === true) {
                names[name] = `xnew${id}-${name}`;
            }
            else {
                throw new Error(`xnew.css: invalid local name "${name}".`);
            }
        }
        const resolve = (block) => block.replace(reference, (_, ref) => {
            if (names[ref] === undefined) {
                throw new Error(`xnew.css: unknown reference "$${ref}".`);
            }
            else {
                return names[ref];
            }
        });
        const text = Object.entries(defs).map(([name, value]) => {
            const def = typeof value === 'string' ? { body: value } : value;
            let rule;
            if (def.type === undefined) {
                rule = `.${names[name]} {\n${resolve(def.body)}\n}`;
            }
            else if (typeName.test(def.type) === true) {
                rule = `@${def.type} ${names[name]} {\n${resolve(def.body)}\n}`;
            }
            else {
                throw new Error(`xnew.css: invalid type "${def.type}".`);
            }
            if (def.layer === undefined) {
                return rule;
            }
            else if (layerName.test(def.layer) === true) {
                return `@layer ${def.layer} {\n${rule}\n}`;
            }
            else {
                throw new Error(`xnew.css: invalid layer "${def.layer}".`);
            }
        }).join('\n');
        const style = document.createElement('style');
        style.textContent = text;
        document.head.appendChild(style);
        entry = { names, refs: 0, style };
        registry.set(key, entry);
    }
    const held = entry;
    held.refs++;
    unit.on('finalize', () => {
        held.refs--;
        if (held.refs === 0) {
            held.style.remove();
            registry.delete(key);
        }
    });
    return held.names;
}

const xnew = Object.assign((function (...args) {
    var _a;
    if (args[0] instanceof Unit) {
        const parent = args.shift();
        const snapshot = (_a = parent._.lastSnapshot) !== null && _a !== void 0 ? _a : Unit.snapshot(parent);
        return Unit.scope(snapshot, () => Unit.create(parent, ...args));
    }
    else {
        return Unit.create(Unit.current, ...args);
    }
}), {
    nest(tag, textContent) {
        if (Unit.current._.phase !== 'invoked') {
            throw new Error('xnew.nest can not be called after initialized.');
        }
        return Unit.nest(Unit.current, tag, textContent);
    },
    extend(Component, props) {
        if (Unit.current._.phase !== 'invoked') {
            throw new Error('xnew.extend can not be called after initialized.');
        }
        if (Unit.current._.Components.includes(Component) === true) {
            console.warn('Component is already extended in this unit:', Component);
        }
        return Unit.extend(Unit.current, Component, props);
    },
    css(defs) {
        return applyCss(Unit.current, defs);
    },
    context(key) {
        return Unit.getContext(Unit.current, key);
    },
    promise: (function (keyOrPromise, maybePromise) {
        const key = typeof keyOrPromise === 'string' ? keyOrPromise : undefined;
        const promise = typeof keyOrPromise === 'string' ? maybePromise : keyOrPromise;
        if (key !== undefined && /^.+\[\d+\]$/.test(key)) {
            throw new Error(`xnew.promise: indexed key "${key}" is no longer supported; use "${key.replace(/\[\d+\]$/, '[]')}" to append in registration order`);
        }
        let source;
        if (promise instanceof Unit) {
            source = UnitPromise.collect(promise._.promises);
        }
        else if (promise instanceof Promise) {
            source = promise;
        }
        else {
            source = new Promise(xnew.scope(promise));
        }
        const unitPromise = new UnitPromise(source, key);
        Unit.current._.promises.push(unitPromise);
        return unitPromise;
    }),
    scope(callback) {
        const snapshot = Unit.snapshot(Unit.current);
        return (...args) => Unit.scope(snapshot, callback, ...args);
    },
    find(Component, opts) {
        return Unit.find(Component, opts === null || opts === void 0 ? void 0 : opts.key);
    },
    emit(type, ...args) {
        return Unit.emit(Unit.current, type, ...args);
    },
    timeout(callback, duration = 0) {
        return new UnitTimer().timeout(callback, duration);
    },
    interval(callback, duration, iterations = 0) {
        return new UnitTimer().interval(callback, duration, iterations);
    },
    transition(transition, duration = 0, easing = 'linear') {
        return new UnitTimer().transition(transition, duration, easing);
    },
    protect() {
        Unit.current._.protected = true;
    },
});

function getEnvironment() {
    return ((typeof window === 'undefined' || typeof window.document === 'undefined') ? 'server' : 'client');
}
const syncData = new WeakMap();
function syncOf(unit) {
    if (syncData.has(unit) === false) {
        syncData.set(unit, { id: null, state: {}, registry: {} });
    }
    return syncData.get(unit);
}
const rootInfos = new WeakMap();
function findRootInfo(unit) {
    for (let u = unit; u !== null; u = u._.parent) {
        const info = rootInfos.get(u);
        if (info !== undefined) {
            return info;
        }
    }
    return undefined;
}
function rootInfoOf(unit) {
    const info = findRootInfo(unit);
    if (info === undefined) {
        throw new Error('no socket bound to this root; create it with xsync.boot({ io, room } | { io, client, room }, ...).');
    }
    return info;
}
const WIRE_TO_SERVER = 'sync:toServer';
const WIRE_TO_CLIENT = 'sync:toClient';
const WIRE_DELIVER = 'sync:deliver';
function dispatch(info, event, id, payload) {
    var _a;
    const data = payload && payload.data !== null && typeof payload.data === 'object' ? payload.data : {};
    const syncId = payload ? payload.syncId : undefined;
    ((_a = Unit.type2units.get(event)) !== null && _a !== void 0 ? _a : []).forEach((unit) => {
        var _a;
        if (findRootInfo(unit) !== info)
            return;
        if (event[0] === '-' && syncOf(unit).id !== syncId)
            return;
        (_a = unit._.listeners.get(event)) === null || _a === void 0 ? void 0 : _a.forEach((item) => item.execute(Object.assign({ id }, data)));
    });
}
function relayToClients(info, type, senderId, syncId, data, ids) {
    const envelope = { type, syncId, id: senderId, data };
    if (Array.isArray(ids) && ids.length > 0) {
        ids.forEach((cid) => info.io.to(cid).emit(WIRE_DELIVER, envelope));
    }
    else {
        info.io.to(info.room.id).emit(WIRE_DELIVER, envelope);
    }
}
function bootServer(opts, parent, args) {
    const { io, room } = opts;
    const info = { io, room, clients: [] };
    const root = new Unit(parent);
    rootInfos.set(root, info);
    Unit.initialize(root, ...args);
    let nextId = 1;
    const captureStateTree = () => {
        const nodes = [];
        const syncName = (unit) => {
            var _a;
            let name = undefined;
            const registry = unit._.parent ? (_a = syncData.get(unit._.parent)) === null || _a === void 0 ? void 0 : _a.registry : undefined;
            if (registry !== undefined) {
                const names = new Map(Object.entries(registry).map(([key, Component]) => [Component, key]));
                for (let i = unit._.Components.length - 1; i >= 0 && name === undefined; i--) {
                    name = names.get(unit._.Components[i]);
                }
            }
            return name;
        };
        const walk = (unit, parent) => {
            var _a;
            const name = syncName(unit);
            if (name !== undefined) {
                const data = syncOf(unit);
                (_a = data.id) !== null && _a !== void 0 ? _a : (data.id = nextId++);
                nodes.push({ id: data.id, name, parent, state: Object.assign({}, data.state) });
                parent = data.id;
            }
            unit._.children.forEach((child) => walk(child, parent));
        };
        walk(root, null);
        return nodes;
    };
    root.on('update', () => io.to(room.id).emit('sync', captureStateTree()));
    io.on('connection', (socket) => {
        var _a, _b;
        const query = (_a = socket.handshake) === null || _a === void 0 ? void 0 : _a.query;
        if ((query === null || query === void 0 ? void 0 : query.roomId) !== room.id)
            return;
        socket.join(room.id);
        info.clients.push({ id: socket.id, name: (_b = query === null || query === void 0 ? void 0 : query.clientName) !== null && _b !== void 0 ? _b : '' });
        dispatch(info, 'sync.connect', socket.id, undefined);
        statusUpdate();
        socket.onAny((event, payload) => {
            var _a;
            if (event === WIRE_TO_SERVER) {
                dispatch(info, payload === null || payload === void 0 ? void 0 : payload.type, socket.id, payload);
            }
            else if (event === WIRE_TO_CLIENT) {
                relayToClients(info, payload === null || payload === void 0 ? void 0 : payload.type, socket.id, (_a = payload === null || payload === void 0 ? void 0 : payload.syncId) !== null && _a !== void 0 ? _a : null, payload === null || payload === void 0 ? void 0 : payload.data, payload === null || payload === void 0 ? void 0 : payload.ids);
            }
        });
        socket.on('disconnect', () => {
            info.clients = info.clients.filter((c) => c.id !== socket.id);
            dispatch(info, 'sync.disconnect', socket.id, undefined);
            statusUpdate();
        });
    });
    function statusUpdate() {
        io.to(room.id).emit('status', { clients: info.clients });
        dispatch(info, 'sync.statusupdate', undefined, undefined);
    }
    return root;
}
function bootClient(opts, parent, args) {
    var _a;
    const { io, room, client } = opts;
    const socket = io({ query: { roomId: room.id, clientName: (_a = client === null || client === void 0 ? void 0 : client.name) !== null && _a !== void 0 ? _a : '' }, forceNew: true });
    const info = { socket, room, clients: [] };
    const root = new Unit(parent);
    rootInfos.set(root, info);
    Unit.initialize(root, ...args);
    const reconcileMap = new Map();
    const applyStateTree = (tree) => {
        const incoming = new Set(tree.map((node) => node.id));
        for (const node of tree) {
            const existing = reconcileMap.get(node.id);
            if (existing !== undefined) {
                Object.assign(syncOf(existing).state, node.state);
                continue;
            }
            const nodeParent = node.parent === null ? root : reconcileMap.get(node.parent);
            const Component = nodeParent && syncOf(nodeParent).registry[node.name];
            if (!Component) {
                continue;
            }
            const unit = new Unit(nodeParent);
            syncData.set(unit, { id: node.id, state: Object.assign({}, node.state), registry: {} });
            Unit.initialize(unit, Component);
            reconcileMap.set(node.id, unit);
        }
        for (const [id, unit] of [...reconcileMap.entries()]) {
            if (!incoming.has(id)) {
                unit.finalize();
                reconcileMap.delete(id);
            }
        }
    };
    socket.on('sync', applyStateTree);
    const onStatus = (status) => {
        var _a;
        info.clients = (_a = status === null || status === void 0 ? void 0 : status.clients) !== null && _a !== void 0 ? _a : [];
        dispatch(info, 'sync.statusupdate', undefined, undefined);
    };
    socket.on('status', onStatus);
    socket.onAny((event, payload) => {
        if (event === WIRE_DELIVER) {
            dispatch(info, payload === null || payload === void 0 ? void 0 : payload.type, payload === null || payload === void 0 ? void 0 : payload.id, payload);
        }
    });
    socket.on('connect', () => Unit.emit(parent, '-connect', { id: socket.id }));
    socket.on('disconnect', () => Unit.emit(parent, '-disconnect', {}));
    socket.on('notfound', (payload) => Unit.emit(parent, '-notfound', payload !== null && payload !== void 0 ? payload : {}));
    root.on('finalize', () => {
        socket.off('sync', applyStateTree);
        socket.off('status', onStatus);
        socket.disconnect();
    });
    return root;
}
const xsync = {
    server(callback, props) {
        return getEnvironment() === 'server' ? Unit.extend(Unit.current, callback, props) : {};
    },
    client(callback, props) {
        return getEnvironment() === 'client' ? Unit.extend(Unit.current, callback, props) : {};
    },
    state(initial = {}) {
        const data = syncOf(Unit.current);
        for (const key of Object.keys(initial)) {
            if (!(key in data.state)) {
                data.state[key] = initial[key];
            }
        }
        return data.state;
    },
    register(Components) {
        const unit = Unit.current;
        if (unit._.phase !== 'invoked') {
            throw new Error('xsync.register must be called during component initialization.');
        }
        Object.assign(syncOf(unit).registry, Components);
    },
    get session() {
        const info = rootInfoOf(Unit.current);
        const isServer = getEnvironment() === 'server';
        return {
            get room() { return info.room; },
            get clients() { return info.clients; },
            get myself() {
                var _a;
                if (isServer) {
                    throw new Error('xsync.session.myself is only available on the client side.');
                }
                const client = info;
                return (_a = client.clients.find((c) => c.id === client.socket.id)) !== null && _a !== void 0 ? _a : { id: client.socket.id, name: '' };
            },
        };
    },
    emitToServer(type, props = {}) {
        const info = rootInfoOf(Unit.current);
        if (getEnvironment() === 'server') {
            Unit.emit(Unit.current, type, props);
        }
        else {
            info.socket.emit(WIRE_TO_SERVER, { type, syncId: syncOf(Unit.current).id, data: props });
        }
    },
    emitToClients(type, props = {}, ids) {
        const info = rootInfoOf(Unit.current);
        const syncId = syncOf(Unit.current).id;
        if (getEnvironment() === 'server') {
            relayToClients(info, type, undefined, syncId, props, ids);
        }
        else {
            info.socket.emit(WIRE_TO_CLIENT, { type, syncId, data: props, ids });
        }
    },
    boot(opts, ...args) {
        if (getEnvironment() === 'server') {
            return bootServer(opts, Unit.current, args);
        }
        else {
            return bootClient(opts, Unit.current, args);
        }
    },
};

function Aspect(unit, { aspect = 1.0, fit = 'contain' } = {}) {
    xnew.nest('<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; container-type: size;">');
    xnew.nest(`<div style="position: relative; aspect-ratio: ${aspect}; container-type: size;">`);
    if (fit === 'contain') {
        unit.element.style.width = `min(100cqw, calc(100cqh * ${aspect}))`;
    }
    else {
        unit.element.style.flexShrink = '0';
        unit.element.style.width = `max(100cqw, calc(100cqh * ${aspect}))`;
    }
}

function Screen(unit, { width = 800, height = 600, fit = 'contain' } = {}) {
    xnew.extend(Aspect, { aspect: width / height, fit });
    const canvas = xnew(`<canvas width="${width}" height="${height}" style="width: 100%; height: 100%; vertical-align: bottom;">`);
    return {
        get canvas() { return canvas.element; },
    };
}

function SceneList(unit, { list = {} } = {}) {
    return {
        resolve(label) {
            const entry = list[label];
            return (Array.isArray(entry) && typeof entry[0] === 'function') ? entry : undefined;
        },
    };
}

function Scene(unit) {
    let leaving = false;
    return {
        change(target, props) {
            var _a;
            const entry = typeof target === 'string' ? (_a = xnew.context(SceneList)) === null || _a === void 0 ? void 0 : _a.resolve(target) : [target, props];
            if (leaving === false && entry !== undefined) {
                leaving = true;
                const timer = typeof unit.leave === 'function' ? unit.leave() : undefined;
                if (timer && typeof timer.timeout === 'function') {
                    timer.timeout(finalize);
                }
                else {
                    finalize();
                }
                function finalize() {
                    xnew(unit.parent, ...entry);
                    unit.finalize();
                }
            }
        },
        add(Component, props) {
            return xnew(unit, Component, props);
        }
    };
}

function Split(unit, { direction = 'column' } = {}) {
    xnew.nest(`<div style="position: relative; width: 100%; height: 100%; display: flex; flex-direction: ${direction};">`);
    return {
        pane({ size, direction }, component) {
            const flex = typeof size === 'number' ? `${size} 1 0` : `0 0 ${size}`;
            const tag = `<div style="position: relative; flex: ${flex}; min-width: 0; min-height: 0; overflow: hidden;">`;
            return xnew(tag, () => {
                if (direction !== undefined) {
                    xnew.extend(Split, { direction });
                }
                if (component !== undefined) {
                    xnew.extend(component);
                }
            });
        },
    };
}

/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
/* global Reflect, Promise, SuppressedError, Symbol, Iterator */


function __rest(s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
}

typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};

function Button$1(unit, _a = {}) {
    var _b, _c, _d;
    var { text = '', className = '', style = '', designs = {} } = _a, others = __rest(_a, ["text", "className", "style", "designs"]);
    const cls = xnew.css({
        container: {
            layer: 'xbasics',
            body: `
                box-sizing: border-box; width: 10rem; height: 1.8rem;
            `,
        },
        button: {
            layer: 'xbasics',
            body: `
                box-sizing: border-box; width: 100%; height: 100%;
                display: flex; justify-content: center; align-items: center;
                padding: 0 0.5em; margin: 0;
                background: transparent; color: inherit; font: inherit;
                border: 1px solid currentColor; border-radius: 0.25em;
                cursor: pointer; user-select: none;
                &:hover { background: color-mix(in srgb, currentColor 20%, transparent); }
                &:active { filter: brightness(0.5); }
            `,
        },
    });
    const container = xnew.nest({ tag: 'div', className: `${cls.container} ${className}`, style });
    xnew.nest(Object.assign({ tag: 'button', type: 'button', className: `${cls.button} ${(_c = (_b = designs.button) === null || _b === void 0 ? void 0 : _b.className) !== null && _c !== void 0 ? _c : ''}`, style: (_d = designs.button) === null || _d === void 0 ? void 0 : _d.style }, others), text);
    return { get container() { return container; } };
}

function Image(unit, _a) {
    var { src, className = '', style = '' } = _a, others = __rest(_a, ["src", "className", "style"]);
    xnew.nest(Object.assign({ tag: 'img', className, style }, others));
    const element = unit.element;
    let objectURL = null;
    function apply(value) {
        if (typeof value === 'string') {
            element.src = value;
        }
        else {
            objectURL = URL.createObjectURL(value instanceof Blob ? value : new Blob([value]));
            element.src = objectURL;
        }
    }
    if (src instanceof Promise) {
        xnew.promise(src).then(apply);
    }
    else {
        apply(src);
    }
    unit.on('finalize', () => {
        if (objectURL !== null) {
            URL.revokeObjectURL(objectURL);
        }
    });
}

function SVG(unit, _a = {}) {
    var { viewBox = '0 0 64 64', className = '', style = '', stroke = 'none', strokeOpacity = 1, strokeWidth = 1, strokeLinejoin = 'round', strokeLinecap = 'round', fill = 'none', fillOpacity = 1 } = _a, others = __rest(_a, ["viewBox", "className", "style", "stroke", "strokeOpacity", "strokeWidth", "strokeLinejoin", "strokeLinecap", "fill", "fillOpacity"]);
    xnew.nest(Object.assign({ tag: 'svg', viewBox,
        className,
        style,
        stroke,
        strokeOpacity,
        strokeWidth,
        strokeLinejoin,
        strokeLinecap,
        fill,
        fillOpacity }, others));
}

function SVGText(unit, _a = {}) {
    var { text = '', fontSize = 20 } = _a, othres = __rest(_a, ["text", "fontSize"]);
    xnew.extend(SVG, Object.assign({ fill: 'currentColor' }, othres));
    const svg = unit.element;
    xnew.nest(`<text x="0" y="0" font-size="${fontSize}" paint-order="stroke fill">`);
    unit.element.textContent = text;
    function resize() {
        const bbox = unit.element.getBBox();
        svg.setAttribute('viewBox', `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`);
        svg.style.width = bbox.width + 'px';
    }
    resize();
    unit.on('resize', resize);
    svg.style.overflow = 'visible';
}

function Spinner(unit, { className = '', style = '' } = {}) {
    const cls = xnew.css({
        turn: {
            layer: 'xbasics',
            type: 'keyframes',
            body: `
                from { transform: rotate(0turn); }
                to { transform: rotate(1turn); }
            `,
        },
        spinner: {
            layer: 'xbasics',
            body: `
                box-sizing: border-box; width: 100%; height: 100%;
                border: 0.15em solid color-mix(in srgb, currentColor 25%, transparent);
                border-top-color: currentColor;
                border-radius: 50%;
                animation: $turn 0.8s linear infinite;
            `,
        },
    });
    xnew.nest(`<div class="${cls.spinner} ${className}" style="${style}">`);
}

function InputRange(unit, { value, min = 0, max = 100, step = 1, name, className = '', style = '', designs = {} } = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    value = value !== null && value !== void 0 ? value : min;
    const cls = xnew.css({
        container: {
            layer: 'xbasics',
            body: `
                box-sizing: border-box; width: 10rem; height: 1.5rem;
                position: relative;
            `,
        },
        frame: {
            layer: 'xbasics',
            body: `
                position: absolute; inset: 0;
                border: 1px solid color-mix(in srgb, currentColor 40%, transparent);
                border-radius: 0.25em;
            `,
        },
        meter: {
            layer: 'xbasics',
            body: `
                position: absolute; top: 0; left: 0; bottom: 0;
                box-sizing: border-box;
                border: 1px solid currentColor; border-radius: 0.25em;
                background: color-mix(in srgb, currentColor 20%, transparent);
                transition: width 0.05s;
            `,
        },
        status: {
            layer: 'xbasics',
            body: `
                position: absolute; inset: 0;
                box-sizing: border-box; padding: 0 0.5em;
                display: flex; justify-content: flex-end; align-items: center;
                pointer-events: none;
            `,
        },
        input: {
            layer: 'xbasics',
            body: `
                position: absolute; inset: 0; width: 100%; height: 100%;
                opacity: 0; cursor: pointer; user-select: none; margin: 0;
                appearance: none;
                &::-webkit-slider-thumb { appearance: none; width: 0; }
                &::-moz-range-thumb { width: 0; border: none; }
            `,
        },
    });
    const container = xnew.nest({ tag: 'div', className: `${cls.container} ${className}`, style });
    xnew({ tag: 'div', className: `${cls.frame} ${(_b = (_a = designs.frame) === null || _a === void 0 ? void 0 : _a.className) !== null && _b !== void 0 ? _b : ''}`, style: (_c = designs.frame) === null || _c === void 0 ? void 0 : _c.style });
    const meter = xnew({ tag: 'div', className: `${cls.meter} ${(_e = (_d = designs.meter) === null || _d === void 0 ? void 0 : _d.className) !== null && _e !== void 0 ? _e : ''}`, style: (_f = designs.meter) === null || _f === void 0 ? void 0 : _f.style });
    const status = xnew({ tag: 'div', className: `${cls.status} ${(_h = (_g = designs.status) === null || _g === void 0 ? void 0 : _g.className) !== null && _h !== void 0 ? _h : ''}`, style: (_j = designs.status) === null || _j === void 0 ? void 0 : _j.style });
    const update = (v) => {
        meter.element.style.width = `${(v - min) / (max - min) * 100}%`;
        status.element.textContent = String(v);
    };
    update(value);
    xnew.nest({ tag: 'input', type: 'range', name, min, max, step, value, className: cls.input });
    unit.on('input', ({ value }) => {
        update(value);
    });
    return { get container() { return container; } };
}

function InputCheckbox(unit, _a = {}) {
    var _b, _c, _d;
    var { value = false, className = '', style = '', designs = {} } = _a, others = __rest(_a, ["value", "className", "style", "designs"]);
    const cls = xnew.css({
        container: {
            layer: 'xbasics',
            body: `
                box-sizing: border-box; width: 1.5rem; height: 1.5rem;
            `,
        },
        check: {
            layer: 'xbasics',
            body: `
                box-sizing: border-box; width: 100%; height: 100%;
                position: relative;
                display: flex; align-items: center; justify-content: center;
                border: 1px solid currentColor; border-radius: 0.25em;
                cursor: pointer; user-select: none;
                svg { opacity: 0; }
                &[data-checked] { background: color-mix(in srgb, currentColor 20%, transparent); }
                &[data-checked] svg { opacity: 1; }
            `,
        },
        input: {
            layer: 'xbasics',
            body: `
                position: absolute; inset: 0; width: 100%; height: 100%;
                opacity: 0; cursor: pointer; margin: 0;
            `,
        },
    });
    const container = xnew.nest({ tag: 'div', className: `${cls.container} ${className}`, style });
    const check = xnew.nest({ tag: 'div', className: `${cls.check} ${(_c = (_b = designs.check) === null || _b === void 0 ? void 0 : _b.className) !== null && _c !== void 0 ? _c : ''}`, style: (_d = designs.check) === null || _d === void 0 ? void 0 : _d.style });
    xnew((unit) => {
        xnew.extend(SVG, { viewBox: '0 0 12 12', style: 'width: 100%; height: 100%;', stroke: 'currentColor', strokeWidth: 2 });
        xnew('<path d="M2 6 5 9 10 3"/>');
    });
    const update = (checked) => {
        check.toggleAttribute('data-checked', checked);
    };
    update(value);
    xnew.nest(Object.assign({ tag: 'input', type: 'checkbox', checked: value, className: cls.input }, others));
    unit.on('input', ({ value }) => {
        update(value);
    });
    return { get container() { return container; } };
}

function InputText(unit, _a = {}) {
    var _b, _c, _d;
    var { className = '', style = '', designs = {} } = _a, others = __rest(_a, ["className", "style", "designs"]);
    const cls = xnew.css({
        container: {
            layer: 'xbasics',
            body: `
                box-sizing: border-box; width: 10rem; height: 1.8rem;
            `,
        },
        field: {
            layer: 'xbasics',
            body: `
                box-sizing: border-box; width: 100%; height: 100%;
                padding: 0 0.5em; margin: 0;
                background: transparent; color: inherit; font: inherit;
                border: 1px solid currentColor; border-radius: 0.25em;
                outline: none;
                &:focus { background: color-mix(in srgb, currentColor 20%, transparent); }
            `,
        },
    });
    const container = xnew.nest({ tag: 'div', className: `${cls.container} ${className}`, style });
    xnew.nest(Object.assign({ tag: 'input', type: 'text', className: `${cls.field} ${(_c = (_b = designs.field) === null || _b === void 0 ? void 0 : _b.className) !== null && _c !== void 0 ? _c : ''}`, style: (_d = designs.field) === null || _d === void 0 ? void 0 : _d.style }, others));
    return { get container() { return container; } };
}

function InputNumber(unit, _a = {}) {
    var _b, _c, _d;
    var { className = '', style = '', designs = {} } = _a, others = __rest(_a, ["className", "style", "designs"]);
    const cls = xnew.css({
        container: {
            layer: 'xbasics',
            body: `
                box-sizing: border-box; width: 10rem; height: 1.8rem;
            `,
        },
        field: {
            layer: 'xbasics',
            body: `
                box-sizing: border-box; width: 100%; height: 100%;
                text-align: center; padding: 0 0.5em; margin: 0;
                background: transparent; color: inherit; font: inherit;
                border: 1px solid currentColor; border-radius: 0.25em;
                outline: none;
                -moz-appearance: textfield; appearance: textfield;
                &::-webkit-inner-spin-button, &::-webkit-outer-spin-button { -webkit-appearance: none; appearance: none; margin: 0; }
                &:focus { background: color-mix(in srgb, currentColor 20%, transparent); }
            `,
        },
    });
    const container = xnew.nest({ tag: 'div', className: `${cls.container} ${className}`, style });
    xnew.nest(Object.assign({ tag: 'input', type: 'number', className: `${cls.field} ${(_c = (_b = designs.field) === null || _b === void 0 ? void 0 : _b.className) !== null && _c !== void 0 ? _c : ''}`, style: (_d = designs.field) === null || _d === void 0 ? void 0 : _d.style }, others));
    return { get container() { return container; } };
}

function InputSwitch(unit, _a = {}) {
    var _b, _c, _d, _e, _f, _g;
    var { value = false, className = '', style = '', designs = {} } = _a, others = __rest(_a, ["value", "className", "style", "designs"]);
    const cls = xnew.css({
        container: {
            layer: 'xbasics',
            body: `
                box-sizing: border-box; width: 3rem; height: 1.5rem;
            `,
        },
        frame: {
            layer: 'xbasics',
            body: `
                box-sizing: border-box; width: 100%; height: 100%;
                position: relative;
                border: 1px solid currentColor; border-radius: 1em;
                cursor: pointer; user-select: none;
                &[data-checked] { background: color-mix(in srgb, currentColor 20%, transparent); }
            `,
        },
        knob: {
            layer: 'xbasics',
            body: `
                position: absolute; top: 0.15em; bottom: 0.15em; left: 0.15em;
                aspect-ratio: 1 / 1; border-radius: 50%;
                background: currentColor;
                transition: left 0.15s, transform 0.15s;
                [data-checked] > & { left: calc(100% - 0.15em); transform: translateX(-100%); }
            `,
        },
        input: {
            layer: 'xbasics',
            body: `
                position: absolute; inset: 0; width: 100%; height: 100%;
                opacity: 0; cursor: pointer; margin: 0;
            `,
        },
    });
    const container = xnew.nest({ tag: 'div', className: `${cls.container} ${className}`, style });
    const frame = xnew.nest({ tag: 'div', className: `${cls.frame} ${(_c = (_b = designs.frame) === null || _b === void 0 ? void 0 : _b.className) !== null && _c !== void 0 ? _c : ''}`, style: (_d = designs.frame) === null || _d === void 0 ? void 0 : _d.style });
    xnew({ tag: 'div', className: `${cls.knob} ${(_f = (_e = designs.knob) === null || _e === void 0 ? void 0 : _e.className) !== null && _f !== void 0 ? _f : ''}`, style: (_g = designs.knob) === null || _g === void 0 ? void 0 : _g.style });
    const update = (checked) => {
        frame.toggleAttribute('data-checked', checked);
    };
    update(value);
    xnew.nest(Object.assign({ tag: 'input', type: 'checkbox', checked: value, className: cls.input }, others));
    unit.on('input', ({ value }) => {
        update(value);
    });
    return { get container() { return container; } };
}

let radioGroupId = 0;
function InputRadio(unit, { value, items = [], name = '', className = '', style = '', designs = {} } = {}) {
    var _a, _b, _c, _d;
    const initial = (_a = value !== null && value !== void 0 ? value : items[0]) !== null && _a !== void 0 ? _a : '';
    const cls = xnew.css({
        container: {
            layer: 'xbasics',
            body: `
                box-sizing: border-box; width: 100%; height: 100%;
            `,
        },
        frame: {
            layer: 'xbasics',
            body: `
                box-sizing: border-box; width: 100%; height: 100%;
                display: flex; align-items: stretch; overflow: hidden;
                border: 1px solid currentColor; border-radius: 0.25em;
            `,
        },
        item: {
            layer: 'xbasics',
            body: `
                flex: 1 1 0;
                position: relative;
                display: flex; align-items: center; justify-content: center;
                white-space: nowrap;
                cursor: pointer; user-select: none;
                & + & { border-left: 1px solid currentColor; }
                &:hover { background: color-mix(in srgb, currentColor 20%, transparent); }
                &[data-checked] { background: color-mix(in srgb, currentColor 20%, transparent); }
            `,
        },
        input: {
            layer: 'xbasics',
            body: `
                position: absolute; inset: 0; width: 100%; height: 100%;
                opacity: 0; cursor: pointer; margin: 0;
            `,
        },
    });
    const group = name !== '' ? name : `xnew-radio-${++radioGroupId}`;
    const container = xnew.nest({ tag: 'div', className: `${cls.container} ${className}`, style });
    xnew.nest({ tag: 'div', className: `${cls.frame} ${(_c = (_b = designs.frame) === null || _b === void 0 ? void 0 : _b.className) !== null && _c !== void 0 ? _c : ''}`, style: (_d = designs.frame) === null || _d === void 0 ? void 0 : _d.style });
    const segments = [];
    items.forEach((item) => {
        var _a, _b, _c;
        const segment = xnew({ tag: 'div', className: `${cls.item} ${(_b = (_a = designs.item) === null || _a === void 0 ? void 0 : _a.className) !== null && _b !== void 0 ? _b : ''}`, style: (_c = designs.item) === null || _c === void 0 ? void 0 : _c.style }, () => {
            xnew('<div>', item);
            xnew({ tag: 'input', type: 'radio', name: group, value: item, checked: item === initial, className: cls.input });
        });
        segments.push([segment, item]);
    });
    const update = (selected) => {
        for (const [segment, item] of segments) {
            segment.element.toggleAttribute('data-checked', item === selected);
        }
    };
    update(initial);
    unit.on('input', ({ value }) => {
        update(value);
    });
    return { get container() { return container; } };
}

function InputSelect(unit, _a = {}) {
    var _b, _c, _d, _e, _f, _g, _h;
    var { value, items = [], className = '', style = '', designs = {} } = _a, others = __rest(_a, ["value", "items", "className", "style", "designs"]);
    const initial = (_b = value !== null && value !== void 0 ? value : items[0]) !== null && _b !== void 0 ? _b : '';
    const cls = xnew.css({
        container: {
            layer: 'xbasics',
            body: `
                box-sizing: border-box; width: 10rem; height: 1.8rem;
            `,
        },
        frame: {
            layer: 'xbasics',
            body: `
                box-sizing: border-box; width: 100%; height: 100%;
                position: relative;
                display: flex; align-items: center;
                border: 1px solid currentColor; border-radius: 0.25em;
                cursor: pointer; user-select: none;
                &:not([data-open]):hover { background: color-mix(in srgb, currentColor 20%, transparent); }
            `,
        },
        label: {
            layer: 'xbasics',
            body: `
                white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            `,
        },
        menu: {
            layer: 'xbasics',
            body: `
                position: fixed; margin-top: 0.25em; width: max-content; z-index: 1000;
                max-height: 12em;
                border: 1px solid currentColor;
                overflow-y: auto; scrollbar-width: thin; scrollbar-color: color-mix(in srgb, currentColor 40%, transparent) transparent;
            `,
        },
        item: {
            layer: 'xbasics',
            body: `
                height: 2em; padding: 0 0.5em;
                display: flex; align-items: center;
                white-space: nowrap;
                cursor: pointer; user-select: none;
                &:hover { background: color-mix(in srgb, currentColor 20%, transparent); }
                &[data-checked] { background: color-mix(in srgb, currentColor 20%, transparent); }
            `,
        },
    });
    const container = xnew.nest({ tag: 'div', className: `${cls.container} ${className}`, style });
    xnew.nest({ tag: 'div', className: `${cls.frame} ${(_d = (_c = designs.frame) === null || _c === void 0 ? void 0 : _c.className) !== null && _d !== void 0 ? _d : ''}`, style: (_e = designs.frame) === null || _e === void 0 ? void 0 : _e.style });
    const frame = unit.element;
    const labelBox = xnew('<div style="flex: 1 1 0; min-width: 0; padding: 0 0.5em;">');
    const label = xnew(labelBox, { tag: 'div', className: `${cls.label} ${(_g = (_f = designs.label) === null || _f === void 0 ? void 0 : _f.className) !== null && _g !== void 0 ? _g : ''}`, style: (_h = designs.label) === null || _h === void 0 ? void 0 : _h.style }, initial);
    for (const item of items) {
        xnew(labelBox, '<div style="visibility: hidden; height: 0; white-space: nowrap;">', item);
    }
    xnew(() => {
        xnew.extend(SVG, { viewBox: '0 0 12 12', stroke: 'currentColor', style: 'flex: none; width: 0.9em; height: 0.9em; margin-right: 0.5em;' });
        xnew('<path d="M3.5 4.5 6 7.5 8.5 4.5"/>');
    });
    let select;
    let dropdown = null;
    const surfaceColor = () => {
        for (let element = frame.parentElement; element !== null; element = element.parentElement) {
            const color = getComputedStyle(element).backgroundColor;
            if (color !== '' && color !== 'transparent' && color !== 'rgba(0, 0, 0, 0)') {
                return color;
            }
        }
        return 'Canvas';
    };
    const closeDropdown = () => {
        dropdown === null || dropdown === void 0 ? void 0 : dropdown.finalize();
        dropdown = null;
    };
    const openDropdown = () => {
        dropdown = xnew(frame, (list) => {
            var _a, _b, _c, _d, _e, _f, _g;
            frame.toggleAttribute('data-open', true);
            list.on('finalize', () => frame.toggleAttribute('data-open', false));
            list.on('pointerdown.outside', () => closeDropdown());
            const menu = xnew.nest({ tag: 'div', className: `${cls.menu} ${(_b = (_a = designs.menu) === null || _a === void 0 ? void 0 : _a.className) !== null && _b !== void 0 ? _b : ''}`, style: `background: ${surfaceColor()}; ${(_d = (_c = designs.menu) === null || _c === void 0 ? void 0 : _c.style) !== null && _d !== void 0 ? _d : ''}` });
            const anchor = () => {
                const rect = frame.getBoundingClientRect();
                menu.style.left = `${rect.left}px`;
                menu.style.top = `${rect.bottom}px`;
                menu.style.minWidth = `${rect.width}px`;
            };
            anchor();
            list.on('update', anchor);
            for (const item of items) {
                const option = xnew({ tag: 'div', className: `${cls.item} ${(_f = (_e = designs.item) === null || _e === void 0 ? void 0 : _e.className) !== null && _f !== void 0 ? _f : ''}`, style: (_g = designs.item) === null || _g === void 0 ? void 0 : _g.style }, item);
                option.element.toggleAttribute('data-checked', item === select.value);
                option.on('click', ({ event }) => {
                    event.stopPropagation();
                    select.value = item;
                    select.dispatchEvent(new Event('input', { bubbles: true }));
                    closeDropdown();
                });
            }
        });
    };
    unit.on('click', () => {
        if (dropdown === null) {
            openDropdown();
        }
        else {
            closeDropdown();
        }
    });
    xnew.nest(Object.assign({ tag: 'select', style: 'display: none;' }, others));
    for (const item of items) {
        xnew({ tag: 'option', value: item, selected: item === initial }, item);
    }
    select = unit.element;
    unit.on('input', ({ value }) => {
        label.element.textContent = value;
    });
    return { get container() { return container; } };
}

var _a;
const DEFAULT_MASTER_GAIN = 0.1;
const AudioContextCtor = typeof window !== 'undefined' ? ((_a = window.AudioContext) !== null && _a !== void 0 ? _a : window.webkitAudioContext) : undefined;
const context = typeof AudioContextCtor === 'function' ? new AudioContextCtor() : null;
const master = context !== null ? context.createGain() : null;
if (context !== null && master !== null) {
    master.gain.value = DEFAULT_MASTER_GAIN;
    master.connect(context.destination);
}

function AudioTrack(unit, { url, volume, loop = false }) {
    let buffer;
    let source = null;
    let startedAt = null;
    let paused = false;
    let pausedOffsetMs = 0;
    let looping = loop;
    const amp = context.createGain();
    amp.gain.value = volume !== null && volume !== void 0 ? volume : 1.0;
    amp.connect(master);
    const fade = context.createGain();
    fade.gain.value = 1.0;
    fade.connect(amp);
    const promise = fetch(url)
        .then((response) => response.arrayBuffer())
        .then((response) => context.decodeAudioData(response))
        .then((response) => { buffer = response; });
    xnew.promise(promise);
    function forceStop() {
        if (source !== null) {
            source.onended = null;
            try {
                source.stop();
            }
            catch (_a) {
            }
            source.disconnect();
            source = null;
        }
        startedAt = null;
    }
    function startSource(offsetMs, fadeMs) {
        const node = context.createBufferSource();
        source = node;
        node.buffer = buffer;
        node.loop = looping;
        node.connect(fade);
        const now = context.currentTime;
        startedAt = now - offsetMs / 1000;
        node.start(now, offsetMs / 1000);
        fade.gain.cancelScheduledValues(now);
        if (fadeMs > 0) {
            fade.gain.setValueAtTime(0, now);
            fade.gain.linearRampToValueAtTime(1.0, now + fadeMs / 1000);
        }
        else {
            fade.gain.setValueAtTime(1.0, now);
        }
        node.onended = () => {
            node.disconnect();
            if (source === node) {
                source = null;
                startedAt = null;
                pausedOffsetMs = 0;
            }
        };
    }
    function stopSource(node, fadeMs) {
        const now = context.currentTime;
        if (fadeMs > 0) {
            fade.gain.setValueAtTime(1.0, now);
            fade.gain.linearRampToValueAtTime(0, now + fadeMs / 1000);
            node.stop(now + fadeMs / 1000);
        }
        else {
            node.stop(now);
        }
    }
    unit.on('finalize', () => {
        forceStop();
        amp.disconnect();
        fade.disconnect();
        pausedOffsetMs = 0;
    });
    return {
        play: function play({ offset, fade: fadeMs = 0, loop: loopArg } = {}) {
            if (buffer === undefined) {
                promise.then(() => play({ offset, fade: fadeMs, loop: loopArg }));
                return;
            }
            if (loopArg !== undefined) {
                looping = loopArg;
            }
            if (startedAt !== null) {
                forceStop();
            }
            paused = false;
            startSource(offset !== null && offset !== void 0 ? offset : pausedOffsetMs, fadeMs);
        },
        pause({ fade: fadeMs = 0 } = {}) {
            if (buffer === undefined || startedAt === null) {
                return;
            }
            const elapsedSec = context.currentTime - startedAt;
            const positionSec = looping ? elapsedSec % buffer.duration : Math.min(elapsedSec, buffer.duration);
            paused = true;
            pausedOffsetMs = positionSec * 1000;
            const node = source;
            source = null;
            startedAt = null;
            stopSource(node, fadeMs);
        },
        get status() {
            if (buffer === undefined) {
                return 'loading';
            }
            else if (startedAt !== null) {
                return 'playing';
            }
            else if (paused) {
                return 'paused';
            }
            else {
                return 'loaded';
            }
        },
        get volume() {
            return amp.gain.value;
        },
        set volume(value) {
            amp.gain.value = value;
        },
    };
}

const DEFAULT_BPM = 120;
const RELEASE_CLEANUP_DELAY_MS = 2000;
const keymap = {
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
const notemap = {
    '1m': 4.000, '2n': 2.000, '4n': 1.000, '8n': 0.500, '16n': 0.250, '32n': 0.125,
};
function resolveFrequency(value) {
    if (typeof value === 'string') {
        return keymap[value];
    }
    else {
        return value;
    }
}
function resolveDurationSeconds(value, bpm) {
    if (typeof value === 'string') {
        return notemap[value] * 60 / bpm;
    }
    else if (typeof value === 'number') {
        return value / 1000;
    }
    else {
        return 0;
    }
}
function semitoneOffset(baseFreq, amount) {
    return baseFreq * (Math.pow(2.0, amount / 12.0) - 1.0);
}
function scheduleAttackDecay(param, start, base, amount, ADSR) {
    const [a, d, s] = ADSR;
    param.value = base;
    param.setValueAtTime(base, start);
    param.linearRampToValueAtTime(base + amount, start + a / 1000);
    param.linearRampToValueAtTime(base + amount * s, start + (a + d) / 1000);
}
function scheduleRelease(param, start, dv, base, amount, ADSR) {
    const [a, d, s, r] = ADSR;
    const end = dv > 0 ? dv : (context.currentTime - start);
    const rate = a === 0 ? 1.0 : Math.min(end / (a / 1000), 1.0);
    if (rate < 1.0) {
        param.cancelScheduledValues(start);
        param.setValueAtTime(base, start);
        param.linearRampToValueAtTime(base + amount * rate, start + (a / 1000) * rate);
        param.linearRampToValueAtTime(base + amount * rate * s, start + ((a + d) / 1000) * rate);
    }
    param.linearRampToValueAtTime(base + amount * rate * s, start + Math.max(((a + d) / 1000) * rate, dv));
    const stop = start + Math.max(((a + d) / 1000) * rate, end) + r / 1000;
    param.linearRampToValueAtTime(base, stop);
    return stop;
}
function createImpulseResponse(timeMs, decay = 2.0) {
    const length = context.sampleRate * timeMs / 1000;
    const impulse = context.createBuffer(2, length, context.sampleRate);
    const ch0 = impulse.getChannelData(0);
    const ch1 = impulse.getChannelData(1);
    for (let i = 0; i < length; i++) {
        const k = Math.pow(1 - i / length, decay);
        ch0[i] = (2 * Math.random() - 1) * k;
        ch1[i] = (2 * Math.random() - 1) * k;
    }
    return impulse;
}
function attachLFO(target, baseFreq, lfo, start) {
    const oscillator = context.createOscillator();
    const depth = context.createGain();
    depth.gain.value = semitoneOffset(baseFreq, lfo.amount);
    oscillator.type = lfo.type;
    oscillator.frequency.value = lfo.rate;
    oscillator.start(start);
    oscillator.connect(depth);
    depth.connect(target.frequency);
    return { oscillator, depth };
}
function attachReverb(amp, target, reverb) {
    const convolver = context.createConvolver();
    convolver.buffer = createImpulseResponse(reverb.time);
    const depth = context.createGain();
    depth.gain.value = reverb.mix;
    target.gain.value *= (1.0 - reverb.mix);
    amp.connect(convolver);
    convolver.connect(depth);
    depth.connect(master);
    return { convolver, depth };
}
function Synthesizer(unit, props) {
    function press(frequency, duration, wait) {
        var _a;
        const freq = resolveFrequency(frequency);
        const dv = resolveDurationSeconds(duration, (_a = props.bpm) !== null && _a !== void 0 ? _a : DEFAULT_BPM);
        const start = context.currentTime + (wait !== null && wait !== void 0 ? wait : 0) / 1000;
        const oscillator = context.createOscillator();
        oscillator.type = props.oscillator.type;
        oscillator.frequency.value = freq;
        const lfo = props.oscillator.LFO ? attachLFO(oscillator, freq, props.oscillator.LFO, start) : null;
        const amp = context.createGain();
        amp.gain.value = 0.0;
        const target = context.createGain();
        target.gain.value = 1.0;
        amp.connect(target);
        target.connect(master);
        let filter = null;
        if (props.filter) {
            filter = context.createBiquadFilter();
            filter.type = props.filter.type;
            filter.frequency.value = props.filter.cutoff;
            oscillator.connect(filter);
            filter.connect(amp);
        }
        else {
            oscillator.connect(amp);
        }
        const reverb = props.reverb ? attachReverb(amp, target, props.reverb) : null;
        if (props.oscillator.envelope) {
            const amount = semitoneOffset(freq, props.oscillator.envelope.amount);
            scheduleAttackDecay(oscillator.frequency, start, freq, amount, props.oscillator.envelope.ADSR);
        }
        if (props.amp.envelope) {
            scheduleAttackDecay(amp.gain, start, 0.0, props.amp.envelope.amount, props.amp.envelope.ADSR);
        }
        oscillator.start(start);
        const oscillators = [oscillator];
        const nodesToDisconnect = [oscillator, amp, target];
        if (lfo) {
            oscillators.push(lfo.oscillator);
            nodesToDisconnect.push(lfo.oscillator, lfo.depth);
        }
        if (filter) {
            nodesToDisconnect.push(filter);
        }
        if (reverb) {
            nodesToDisconnect.push(reverb.convolver, reverb.depth);
        }
        const release = () => {
            if (props.oscillator.envelope) {
                const amount = semitoneOffset(freq, props.oscillator.envelope.amount);
                scheduleRelease(oscillator.frequency, start, dv, freq, amount, props.oscillator.envelope.ADSR);
            }
            let stop;
            if (props.amp.envelope) {
                stop = scheduleRelease(amp.gain, start, dv, 0.0, props.amp.envelope.amount, props.amp.envelope.ADSR);
            }
            else {
                stop = start + (dv > 0 ? dv : (context.currentTime - start));
            }
            for (const o of oscillators) {
                o.stop(stop);
            }
            setTimeout(() => {
                for (const n of nodesToDisconnect) {
                    n.disconnect();
                }
            }, RELEASE_CLEANUP_DELAY_MS);
        };
        if (dv > 0) {
            release();
        }
        else {
            return { release };
        }
    }
    return { press };
}

function Volume(unit) {
    return {
        get volume() {
            return master.gain.value;
        },
        set volume(value) {
            master.gain.value = value;
        },
    };
}

function OpenAndClose(unit, { open = true, duration = 200, easing = 'ease' }) {
    let value = open ? 1.0 : 0.0;
    let sign = open ? +1 : -1;
    let timer = xnew.timeout(() => xnew.emit('-transition', { value }));
    function animate(dir) {
        sign = dir;
        const d = dir > 0 ? 1 - value : value;
        timer.clear();
        timer = xnew.transition(({ value: x }) => {
            const remaining = x < 1.0 ? (1 - x) * d : 0.0;
            value = dir > 0 ? 1.0 - remaining : remaining;
            xnew.emit('-transition', { value });
        }, duration * d, easing)
            .timeout(() => xnew.emit(dir > 0 ? '-opened' : '-closed'));
    }
    return {
        toggle() {
            animate(sign < 0 ? +1 : -1);
        },
        open() {
            animate(+1);
        },
        close() {
            animate(-1);
        },
    };
}

function Accordion(unit) {
    const system = xnew.context(OpenAndClose);
    const outer = xnew.nest('<div style="overflow: hidden;">');
    const inner = xnew.nest('<div style="display: flex; flex-direction: column; box-sizing: border-box;">');
    system.on('-transition', ({ value }) => {
        outer.style.height = value < 1.0 ? inner.offsetHeight * value + 'px' : 'auto';
        outer.style.opacity = value.toString();
    });
}

function Popup(unit) {
    const system = xnew.context(OpenAndClose);
    system.on('-closed', () => unit.finalize());
    system.open();
    xnew.nest('<div style="position: fixed; inset: 0; z-index: 1000; opacity: 0;">');
    unit.on('click', ({ event }) => event.target === unit.element && system.close());
    system.on('-transition', ({ value }) => {
        unit.element.style.opacity = value.toString();
    });
}

const touchArea$1 = 'width: 100%; height: 100%; cursor: pointer; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; touch-action: none; pointer-events: auto;';
const overlay$1 = 'position: absolute; inset: 0; width: 100%; height: 100%; box-sizing: border-box;';
function AnalogStick(unit, { stroke = 'currentColor', strokeOpacity = 0.8, strokeWidth = 1, strokeLinejoin = 'round', strokeLinecap = 'round', fill = '#FFF', fillOpacity = 0.8 } = {}) {
    xnew.extend(Aspect, { aspect: 1.0, fit: 'contain' });
    xnew.nest(`<div style="${touchArea$1}">`);
    xnew((unit) => {
        xnew.extend(SVG, { style: overlay$1, stroke, strokeOpacity, strokeWidth, strokeLinejoin, strokeLinecap, fill, fillOpacity });
        xnew('<polygon points="32  7 27 13 37 13">');
        xnew('<polygon points="32 57 27 51 37 51">');
        xnew('<polygon points=" 7 32 13 27 13 37">');
        xnew('<polygon points="57 32 51 27 51 37">');
    });
    const target = xnew((unit) => {
        xnew.extend(SVG, { style: overlay$1, stroke, strokeOpacity, strokeWidth, strokeLinejoin, strokeLinecap, fill, fillOpacity });
        xnew('<circle cx="32" cy="32" r="14">');
    });
    unit.on('dragstart dragmove', ({ type, position }) => {
        const size = unit.element.clientWidth;
        const x = position.x - size / 2;
        const y = position.y - size / 2;
        const d = Math.min(1.0, Math.sqrt(x * x + y * y) / (size / 4));
        const a = (y !== 0 || x !== 0) ? Math.atan2(y, x) : 0;
        const vector = { x: Math.cos(a) * d, y: Math.sin(a) * d };
        Object.assign(target.element.style, { filter: 'brightness(80%)', left: `${vector.x * size / 4}px`, top: `${vector.y * size / 4}px` });
        xnew.emit({ dragstart: '-down', dragmove: '-move' }[type], { vector });
    });
    unit.on('dragend', () => {
        Object.assign(target.element.style, { filter: '', left: '0px', top: '0px' });
        xnew.emit('-up', { vector: { x: 0, y: 0 } });
    });
}

const touchArea = 'width: 100%; height: 100%; cursor: pointer; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; touch-action: none; pointer-events: auto;';
const overlay = 'position: absolute; inset: 0; width: 100%; height: 100%; box-sizing: border-box;';
function DPad(unit, { diagonal = true, stroke = 'currentColor', strokeOpacity = 0.8, strokeWidth = 1, strokeLinejoin = 'round', strokeLinecap = 'round', fill = '#FFF', fillOpacity = 0.8 } = {}) {
    xnew.extend(Aspect, { aspect: 1.0, fit: 'contain' });
    xnew.nest(`<div style="${touchArea}">`);
    const polygons = [
        '<polygon points="32 32 23 23 23  4 24  3 40  3 41  4 41 23">',
        '<polygon points="32 32 23 41 23 60 24 61 40 61 41 60 41 41">',
        '<polygon points="32 32 23 23  4 23  3 24  3 40  4 41 23 41">',
        '<polygon points="32 32 41 23 60 23 61 24 61 40 60 41 41 41">'
    ];
    const targets = polygons.map((polygon) => {
        return xnew((unit) => {
            xnew.extend(SVG, { style: overlay, fill, fillOpacity });
            xnew(polygon);
        });
    });
    xnew((unit) => {
        xnew.extend(SVG, { style: overlay, stroke, strokeOpacity, strokeWidth, strokeLinejoin, strokeLinecap });
        xnew('<polyline points="23 23 23  4 24  3 40  3 41  4 41 23">');
        xnew('<polyline points="23 41 23 60 24 61 40 61 41 60 41 41">');
        xnew('<polyline points="23 23  4 23  3 24  3 40  4 41 23 41">');
        xnew('<polyline points="41 23 60 23 61 24 61 40 60 41 41 41">');
        xnew('<polygon points="32  7 27 13 37 13">');
        xnew('<polygon points="32 57 27 51 37 51">');
        xnew('<polygon points=" 7 32 13 27 13 37">');
        xnew('<polygon points="57 32 51 27 51 37">');
    });
    unit.on('dragstart dragmove', ({ type, position }) => {
        const size = unit.element.clientWidth;
        const x = position.x - size / 2;
        const y = position.y - size / 2;
        const a = (y !== 0 || x !== 0) ? Math.atan2(y, x) : 0;
        const d = Math.min(1.0, Math.sqrt(x * x + y * y) / (size / 4));
        const vector = { x: Math.cos(a) * d, y: Math.sin(a) * d };
        if (diagonal === true) {
            vector.x = Math.abs(vector.x) > 0.5 ? Math.sign(vector.x) : 0;
            vector.y = Math.abs(vector.y) > 0.5 ? Math.sign(vector.y) : 0;
        }
        else if (Math.abs(vector.x) > Math.abs(vector.y)) {
            vector.x = Math.abs(vector.x) > 0.5 ? Math.sign(vector.x) : 0;
            vector.y = 0;
        }
        else {
            vector.x = 0;
            vector.y = Math.abs(vector.y) > 0.5 ? Math.sign(vector.y) : 0;
        }
        targets[0].element.style.filter = (vector.y < 0) ? 'brightness(80%)' : '';
        targets[1].element.style.filter = (vector.y > 0) ? 'brightness(80%)' : '';
        targets[2].element.style.filter = (vector.x < 0) ? 'brightness(80%)' : '';
        targets[3].element.style.filter = (vector.x > 0) ? 'brightness(80%)' : '';
        xnew.emit({ dragstart: '-down', dragmove: '-move' }[type], { vector });
    });
    unit.on('dragend', () => {
        targets[0].element.style.filter = '';
        targets[1].element.style.filter = '';
        targets[2].element.style.filter = '';
        targets[3].element.style.filter = '';
        xnew.emit('-up', { vector: { x: 0, y: 0 } });
    });
}

const rowStyle = 'position: relative; height: 2em; margin: 0.125em 0; display: flex; align-items: center;';
const clickableCss = {
    clickable: { layer: 'xbasics', body: 'cursor: pointer; user-select: none;' },
};
function Panel(unit, { params, nested }) {
    const object = params !== null && params !== void 0 ? params : {};
    if (!nested) {
        const cls = xnew.css({
            scroll: { layer: 'xbasics', body: 'overflow-y: auto; scrollbar-width: thin; scrollbar-color: color-mix(in srgb, currentColor 40%, transparent) transparent;' },
        });
        xnew.nest('<div style="display: flex; flex-direction: column; box-sizing: border-box; max-height: inherit; padding: 0.5em 0;">');
        xnew.nest(`<div class="${cls.scroll}" style="min-height: 0; padding: 0 0.25em;">`);
    }
    return {
        group({ name, open, params }, inner) {
            return xnew((unit) => {
                xnew.extend(Group, { name, open });
                xnew.extend(Panel, { params: params !== null && params !== void 0 ? params : object, nested: true });
                inner(unit);
            });
        },
        button({ name = '' } = {}) {
            return xnew(Button, { name });
        },
        select({ name = '', value, items = [] } = {}) {
            var _a, _b;
            object[name] = (_b = (_a = value !== null && value !== void 0 ? value : object[name]) !== null && _a !== void 0 ? _a : items[0]) !== null && _b !== void 0 ? _b : '';
            const select = xnew(Select, { name, value: object[name], items });
            select.on('input', ({ value }) => object[name] = value);
            return select;
        },
        range({ name = '', value, min = 0, max = 100, step = 1 } = {}) {
            var _a;
            object[name] = (_a = value !== null && value !== void 0 ? value : object[name]) !== null && _a !== void 0 ? _a : min;
            const range = xnew(Range, { name, value: object[name], min, max, step });
            range.on('input', ({ value }) => object[name] = value);
            return range;
        },
        checkbox({ name = '', value } = {}) {
            var _a;
            object[name] = (_a = value !== null && value !== void 0 ? value : object[name]) !== null && _a !== void 0 ? _a : false;
            const checkbox = xnew(Checkbox, { name, value: object[name] });
            checkbox.on('input', ({ value }) => object[name] = value);
            return checkbox;
        },
        separator() {
            xnew(Separator);
        }
    };
}
function Group(group, { name, open = false }) {
    const openAndClose = xnew.extend(OpenAndClose, { open });
    if (name) {
        const cls = xnew.css(clickableCss);
        xnew(`<div class="${cls.clickable}" style="${rowStyle}">`, (unit) => {
            unit.on('click', () => openAndClose.toggle());
            xnew((unit) => {
                xnew.extend(SVG, { viewBox: '0 0 12 12', stroke: 'currentColor', style: 'width: 1em; height: 1em; margin-right: 0.25em;' });
                xnew('<path d="M6 2 10 6 6 10"/>');
                group.on('-transition', ({ value }) => unit.element.style.transform = `rotate(${value * 90}deg)`);
            });
            xnew('<div>', name);
        });
    }
    xnew.extend(Accordion);
}
function Button(unit, { name = '' }) {
    const cls = xnew.css({
        button: {
            layer: 'xbasics',
            body: `
                cursor: pointer; user-select: none;
                border: 1px solid currentColor; border-radius: 0.25em;
                &:hover { background: color-mix(in srgb, currentColor 20%, transparent); }
                &:active { filter: brightness(0.5); }
            `,
        },
    });
    xnew.nest(`<button class="${cls.button}" style="${rowStyle} justify-content: center;">`, name);
}
function Separator(unit) {
    xnew.nest(`<div style="margin: 0.5em 0; border-top: 1px solid currentColor;">`);
}
function Range(unit, { name = '', value, min = 0, max = 100, step = 1 }) {
    const cls = xnew.css(clickableCss);
    xnew.nest(`<div class="${cls.clickable}" style="${rowStyle}">`);
    xnew(InputRange, { name, value, min, max, step, style: 'width: 100%; height: 100%;' });
    xnew('<div style="position: absolute; inset: 0; width: 100%; height: 100%; box-sizing: border-box; padding: 0 0.5em; display: flex; align-items: center; pointer-events: none;">', name);
}
function Checkbox(unit, { name = '', value } = {}) {
    const cls = xnew.css(clickableCss);
    xnew.nest(`<label class="${cls.clickable}" style="${rowStyle} padding: 0 0.5em;">`);
    xnew('<div style="flex: 1;">', name);
    xnew(InputCheckbox, { name, value, style: 'width: 1.25em; height: 1.25em;' });
}
function Select(unit, { name = '', value, items = [] } = {}) {
    xnew.nest(`<div style="${rowStyle} padding: 0 0.5em;">`);
    xnew('<div style="flex: 1;">', name);
    xnew(InputSelect, { name, value, items, style: 'width: auto; min-width: 3em; height: 2em;' });
}

const xbasics = {
    Aspect,
    Screen,
    Scene,
    SceneList,
    Split,
    Button: Button$1,
    Image,
    SVG,
    SVGText,
    Spinner,
    InputRange,
    InputCheckbox,
    InputText,
    InputNumber,
    InputSwitch,
    InputRadio,
    InputSelect,
    AudioTrack,
    Synthesizer,
    Volume,
    OpenAndClose,
    Accordion,
    Popup,
    AnalogStick,
    DPad,
    Panel,
};

export { xbasics, xnew, xsync };
