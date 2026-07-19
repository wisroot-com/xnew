//----------------------------------------------------------------------------------------------------
// Unit — the lifecycle, ownership, and scoping primitive of xnew
// A Unit bundles DOM, components, children, listeners, and promises into one disposable node;
// listeners record their owner, so a finalized owner's listeners elsewhere detach automatically.
//----------------------------------------------------------------------------------------------------

import { MapSet, MapMap } from './map';
import { Ticker, Timer } from './time';
import { EventBinder, isDomElement, DomElement, DomElementDef, isElementDef, createElement } from './dom';

//----------------------------------------------------------------------------------------------------
// definitions
//----------------------------------------------------------------------------------------------------

interface Context { previous: Context | null; key?: any; value?: any; }

interface Snapshot { unit: Unit; context: Context; element: DomElement; Component: Function | null; }

// Component function type; the returned defines are merged into the xnew(...) return value (Unit & A).
export type ComponentFn<P extends object = any, A extends object = {}> = (unit: Unit, props: P) => A | void;

// Extract the defines type of a Component (void falls back to {}).
export type DefinesOf<C> = C extends (...args: any[]) => infer R ? ([R] extends [void] ? {} : Exclude<R, void | undefined>) : {};

// Extract the props type of a Component ({} if absent).
export type PropsOf<C> = C extends (unit: Unit, props: infer P, ...rest: any[]) => any ? P : {};

// Component that writes a text/number literal into the unit's current element.
// Used for both the base (xnew(target, 'text')) and the trailing ExComponent (xnew(Base, props, 'text')) forms.
function textComponent(content: string | number): (unit: Unit) => void {
    return (unit: Unit) => { unit.element.textContent = content.toString(); };
}

//----------------------------------------------------------------------------------------------------
// unit
//----------------------------------------------------------------------------------------------------

export class Unit {
    [key: string]: any;

    public _: {
        parent: Unit | null;
        children: Unit[];

        phase: 'invoked' | 'initialized' | 'finalizing' | 'finalized';
        protected: boolean;
        composed: boolean;
        promises: UnitPromise[];
        defines: Record<string, any>;
        systems: Record<'update' | 'finalize', { listener: Function, execute: Function, count: number, owner: Unit }[]>;

        currentElement: DomElement;
        currentContext: Context;
        currentComponent: Function | null;

        lastSnapshot: Snapshot | null;

        nestElements: DomElement[];
        Components: Function[];
        listeners: MapMap<string, Function, { execute: Function, owner: Unit }>;
        events: EventBinder;

        key: any;   // reserved prop for find(key) (global unique assumed)
    };

    constructor(parent: Unit | null = null) {
        parent?._.children.push(this);

        const baseContext = parent?._.currentContext ?? { previous: null };

        let baseElement: DomElement;
        if (parent !== null) {
            baseElement = parent._.currentElement;
        } else if (globalThis.document?.body) {
            baseElement = globalThis.document.body;
        } else {
            baseElement = null as unknown as DomElement;
        }

        this._ = {
            parent,
            phase: 'invoked',
            protected: false,
            composed: false,
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

    static create(parent: Unit | null, ...args: any[]): Unit {
        const unit = new Unit(parent);
        Unit.initialize(unit, ...args);
        return unit;
    }

    static initialize(unit: Unit, ...args: any[]): void {
        if (isDomElement(args[0])) {
            unit._.currentElement = args.shift() as DomElement;
        } else if (typeof args[0] === 'string' || isElementDef(args[0]) === true) {
            Unit.nest(unit, args.shift() as string | DomElementDef);
        }

        // xnew(Base, props?, ExComponent?): pull off the component, then an optional props
        // object, then a trailing extension component extended on top of Base.
        const Component = args.shift() as Function | string | number | undefined;

        let props: Object | undefined;
        if (typeof args[0] === 'object') {
            props = args.shift() as Object | undefined;
        }

        // a trailing function extends on top of Base; a trailing string/number sets the element's text
        let ExComponent: Function | undefined;
        if (typeof args[0] === 'function') {
            ExComponent = args.shift() as Function;
        } else if (typeof args[0] === 'string' || typeof args[0] === 'number') {
            ExComponent = textComponent(args.shift() as string | number);
        }

        let baseComponent: Function;
        if (typeof Component === 'function') {
            baseComponent = Component;
        } else if (typeof Component === 'string' || typeof Component === 'number') {
            baseComponent = textComponent(Component);
        } else {
            baseComponent = (unit: Unit) => {};
        }

        unit._.key = (props as any)?.key ?? null;

        const backup = Unit.currentUnit;
        Unit.currentUnit = unit;

        // a trailing ExComponent is composed with the base inside one synthetic component, so both reach
        // the unit through the ordinary nested extend and each sees itself as composed (no special-casing)
        if (ExComponent !== undefined) {
            const Ex = ExComponent;
            Unit.extend(unit, (unit: Unit, props: Object) => {
                Unit.extend(unit, baseComponent, props);
                Unit.extend(unit, Ex, props);
            }, props);
        } else {
            Unit.extend(unit, baseComponent, props);
        }

        if (unit._.phase === 'invoked') {
            unit._.phase = 'initialized';
        }
        unit._.lastSnapshot = Unit.snapshot(unit);
        Unit.currentUnit = backup;
    }

    public get parent(): Unit | null {
        return this._.parent;
    }
    
    public get element(): DomElement {
        return this._.currentElement;
    }

    public finalize(): void {
        if (this._.phase !== 'finalized' && this._.phase !== 'finalizing') {
            this._.phase = 'finalizing';

            [...this._.children].reverse().forEach((child: Unit) => child.finalize());
            [...this._.systems.finalize].reverse().forEach(({ execute }) => execute());

            // detach the listeners this unit registered on other units
            Unit.owner2targets.get(this)?.forEach((target) => {
                [...target._.listeners.keys(), 'update', 'finalize'].forEach((type) => Unit.off(target, this, type));
            });
            Unit.owner2targets.delete(this);

            // clear all listeners on this unit regardless of owner
            [...this._.listeners.keys(), 'update', 'finalize'].forEach((type) => Unit.off(this, null, type));

            [...this._.nestElements].reverse().forEach((element) => element.remove());
            this._.Components.forEach((Component) => Unit.component2units.delete(Component, this));

            // remove contexts
            const contexts = Unit.unit2Contexts.get(this);
            contexts?.forEach((context: Context) => {
                let temp = context.previous;
                while(temp !== null) {
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
                this._.parent._.children = this._.parent._.children.filter((u: Unit) => u !== this);
            }
            this._.phase = 'finalized';
        }
    }

    static nest(unit: Unit, tag: string | DomElementDef, textContent?: string): DomElement {
        const element = createElement(unit._.currentElement, tag);
        unit._.currentElement = element;
        if (textContent !== undefined) {
            element.textContent = textContent;
        }
        unit._.nestElements.push(element);
        return element;
    }

    static extend(unit: Unit, Component: Function, props?: Object): { [key: string]: any } {
        const backupComponent = unit._.currentComponent;
        const backupComposed = unit._.composed;
        // composed is scoped to this invocation (restored on exit) so a component's own inner xnew.extend
        // never flips its own value: true when it rides on an outer component, false when it is the base
        unit._.composed = backupComponent !== null;
        unit._.currentComponent = Component;

        if (unit._.parent !== null) {
            Unit.addContext(unit._.parent, unit, Component, unit);
        }
        Unit.addContext(unit, unit, Component, unit);

        const defines = Component(unit, props ?? {}) ?? {};

        unit._.currentComponent = backupComponent;
        unit._.composed = backupComposed;

        Unit.component2units.add(Component, unit);
        unit._.Components.push(Component);

        Object.keys(defines).forEach((key) => {
            if (unit[key] !== undefined && unit._.defines[key] === undefined) {
                throw new Error(`The property "${key}" already exists.`);
            }
            const descriptor = Object.getOwnPropertyDescriptor(defines, key);
            const wrapper: PropertyDescriptor = { configurable: true, enumerable: true };
            const snapshot = Unit.snapshot(unit);

            if (descriptor?.get || descriptor?.set) {
                if (descriptor?.get) wrapper.get = (...args: any[]) => Unit.scope(snapshot, descriptor.get as Function, ...args);
                if (descriptor?.set) wrapper.set = (...args: any[]) => Unit.scope(snapshot, descriptor.set as Function, ...args);
            } else if (typeof descriptor?.value === 'function') {
                wrapper.value = (...args: any[]) => Unit.scope(snapshot, descriptor.value, ...args);
            } else {
                throw new Error(`Only function properties can be defined as Component defines. [${key}]`);
            }
            Object.defineProperty(unit._.defines, key, wrapper);
            Object.defineProperty(unit, key, wrapper);
        });

        let clone = {};
        Object.defineProperties(clone, Object.getOwnPropertyDescriptors(unit._.defines));
        return clone;
    }

    // Drives only initialized units. Listeners receive ({ count, delta }): count is per
    // registration (starting at 0), delta is elapsed ms since the previous frame.
    static update(unit: Unit, delta: number = 0): void {
        if (unit._.phase === 'initialized') {
            unit._.children.forEach((child: Unit) => Unit.update(child, delta));
            // iterate a copy: a listener may remove itself (once / off) mid-dispatch
            [...unit._.systems.update].forEach((entry) => entry.execute({ count: entry.count++, delta }));
        }
    }

    static engineRoot: Unit;
    static currentUnit: Unit;

    // the current unit as read from outside unit.ts, initializing the engine on first access;
    // inside unit.ts read only the raw fields (reading this getter during reset() would recurse before engineRoot is assigned)
    static get current(): Unit {
        if (Unit.engineRoot === undefined) {
            Unit.reset();
        }
        return Unit.currentUnit;
    }

    static reset(): void {
        Unit.engineRoot?.finalize();
        Unit.currentUnit = Unit.engineRoot = Unit.create(null);
        const ticker = new Ticker((delta: number) => {
            Unit.update(Unit.engineRoot, delta);
        });
        Unit.engineRoot.on('finalize', () => ticker.clear());
    }

    static scope(snapshot: Snapshot, func: Function, ...args: any[]): any {
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
        } finally {
            Unit.currentUnit = currentUnit;
            snapshot.unit._.currentContext = backup.context;
            snapshot.unit._.currentElement = backup.element;
            snapshot.unit._.currentComponent = backup.Component;
        }
    }

    static snapshot(unit: Unit): Snapshot {
        return { unit, context: unit._.currentContext, element: unit._.currentElement, Component: unit._.currentComponent };
    }

    static unit2Contexts: MapSet<Unit, Context> = new MapSet();

    static addContext(unit: Unit, orner: Unit, key: any, value?: any): void {
        unit._.currentContext = { previous: unit._.currentContext, key, value };
        Unit.unit2Contexts.add(orner, unit._.currentContext);
    }

    static getContext(unit: Unit, key: any): any {
        for (let context = unit._.currentContext; context.previous !== null; context = context.previous) {
            if (context.value === Unit.currentUnit && key === unit._.currentComponent) continue;
            if (key === context.key) return context.value;
        }
    }

    static component2units: MapSet<Function, Unit> = new MapSet();

    // Ancestor chain (excluding unit itself).
    static ancestors(unit: Unit | null): Unit[] {
        const ancestors: Unit[] = [];
        for (let u = unit?._.parent ?? null; u !== null; u = u._.parent) ancestors.push(u);
        return ancestors;
    }

    // Visibility across protect boundaries: find the nearest protected ancestor of `from`;
    // visible if there is none, or if it is `current` or one of its ancestors.
    static isVisible(from: Unit | null, current: Unit | null, ancestors: Unit[]): boolean {
        let boundary: Unit | undefined;
        for (let u = from; u !== null; u = u._.parent) {
            if (u._.protected === true) { boundary = u; break; }
        }
        return boundary === undefined || ancestors.includes(boundary) === true || current === boundary;
    }

    static find(Component: Function, key?: any): Unit[] {
        const current = Unit.currentUnit;
        const ancestors = Unit.ancestors(current);
        return [...(Unit.component2units.get(Component) ?? [])].filter((unit) => {
            if (key !== undefined && unit._.key !== key) {
                return false;
            }
            return Unit.isVisible(unit._.parent, current, ancestors);
        });
    }

    //----------------------------------------------------------------------------------------------------
    // event
    //----------------------------------------------------------------------------------------------------
    
    static type2units = new MapSet<string, Unit>();
  
    public on(type: string, listener: Function, options?: boolean | AddEventListenerOptions): void {
        const types = type.trim().split(/\s+/);

        types.forEach((type) => Unit.on(this, type, listener, options));
    }

    // self-removing listener; with space-separated types each type fires once independently
    public once(type: string, listener: Function, options?: boolean | AddEventListenerOptions): void {
        const owner = Unit.currentUnit;
        const types = type.trim().split(/\s+/);

        types.forEach((type) => {
            // removal happens before invocation, so an emit inside the listener cannot re-fire it
            const wrapper = (props: object) => {
                Unit.off(this, owner, type, wrapper);
                listener(props);
            };
            Unit.on(this, type, wrapper, options);
        });
    }

    public off(type?: string, listener?: Function): void {
        const types = typeof type === 'string' ? type.trim().split(/\s+/) : [...this._.listeners.keys(), 'update', 'finalize'];

        types.forEach((type) => Unit.off(this, Unit.currentUnit, type, listener));
    }
    
    // owner (the unit whose scope called on) → the units it registered listeners on
    static owner2targets = new MapSet<Unit, Unit>();

    static on(unit: Unit, type: string, listener: Function, options?: boolean | AddEventListenerOptions): void {
        const owner = Unit.currentUnit;
        const snapshot = Unit.snapshot(owner);
        const execute = (props: object = {}) => {
            Unit.scope(snapshot, listener, Object.assign({ type }, props));
        }
        if (type === 'update' || type === 'finalize') {
            // lifecycle-only: registered in systems, never in the dispatch path (listeners / type2units / events).
            unit._.systems[type].push({ listener, execute, count: 0, owner });
        } else if (unit._.listeners.has(type, listener) === false) {
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

    // remove the entries that `owner` registered (owner: null matches any owner; listener narrows further)
    static off(unit: Unit, owner: Unit | null, type: string, listener?: Function): void {
        const match = (lis: Function, own: Unit) => (owner === null || own === owner) && (listener === undefined || lis === listener);
        if (type === 'update' || type === 'finalize') {
            unit._.systems[type] = unit._.systems[type].filter((entry) => match(entry.listener, entry.owner) === false);
        } else {
            [...(unit._.listeners.get(type)?.entries() ?? [])].forEach(([lis, item]) => {
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

    static emit(unit: Unit, type: string, props: object = {}): void {
        if (type[0] === '+') {
            const ancestors = Unit.ancestors(unit);
            Unit.type2units.get(type)?.forEach((target) => {
                if (Unit.isVisible(target, unit, ancestors)) {
                    target._.listeners.get(type)?.forEach((item) => item.execute(props));
                }
            });
        } else if (type[0] === '-') {
            unit._.listeners.get(type)?.forEach((item) => item.execute(props));
        }
    }
}

//----------------------------------------------------------------------------------------------------
// extensions
//----------------------------------------------------------------------------------------------------

export class UnitPromise {
    constructor(private promise: Promise<any>, public key?: string) {}

    // then / catch / finally run the callback in the captured scope; the return value becomes the
    // chain value (a returned UnitPromise unwraps to its inner promise for async continuation).
    private chain(method: 'then' | 'catch' | 'finally', callback: Function): UnitPromise {
        const snapshot = Unit.snapshot(Unit.currentUnit);
        this.promise = (this.promise[method] as Function)((...args: any[]) => {
            const result = Unit.scope(snapshot, callback, ...args);
            return result instanceof UnitPromise ? result.promise : result;
        });
        return this;
    }
    public then(callback: Function): UnitPromise { return this.chain('then', callback); }
    public catch(callback: Function): UnitPromise { return this.chain('catch', callback); }
    public finally(callback: Function): UnitPromise { return this.chain('finally', callback); }

    // Aggregate promises into one Promise resolving to an object: keyed entries are included
    // (a `name[]` key pushes into out[name] in registration order); unkeyed ones are awaited only.
    public static async collect(promises: UnitPromise[]): Promise<Record<string, any>> {
        const values = await Promise.all(promises.map(p => p.promise));
        const out: Record<string, any> = {};
        promises.forEach((p, i) => {
            if (p.key === undefined) { return; }
            const matched = p.key.match(/^(.+)\[\]$/);
            if (matched !== null) {
                const name = matched[1];
                if (Array.isArray(out[name]) === false) { out[name] = []; }
                out[name].push(values[i]);
            } else {
                out[p.key] = values[i];
            }
        });
        return out;
    }
}

export class UnitTimer {
    private unit: Unit | null = null;
    private queue: Function[] = [];

    public clear() {
        this.queue = [];
        this.unit?.finalize();
        this.unit = null;
    }

    public timeout(timeout: Function, duration: number = 0) {
        return this.execute(timeout, null, duration, 1);
    }
    public interval(timeout: Function, duration: number = 0, iterations: number = 0) {
        return this.execute(timeout, null, duration, iterations);
    }
    public transition(transition: Function, duration: number = 0, easing?: string) {
        return this.execute(null, transition, duration, 1, easing);
    }

    private execute(timeout: Function | null, transition: Function | null, duration: number, iterations: number, easing?: string) {
        const snapshot = Unit.snapshot(Unit.currentUnit);

        // Timer parameters are captured by closure, not passed as props.
        const Component = (unit: Unit) => {
            let counter = 0;
            let current = new Timer(onTimeout, onTransition, duration, easing);

            function onTimeout() {
                if (timeout) Unit.scope(snapshot, timeout, { count: counter });
                // if the callback called timer.clear(), the unit is finalized — do not reschedule.
                if (unit._.phase === 'finalized') { return; }
                if (iterations <= 0 || counter < iterations - 1) {
                    current = new Timer(onTimeout, onTransition, duration, easing);
                } else {
                    unit.finalize();
                }
                counter++;
            }
            function onTransition(value: number) {
                if (transition) Unit.scope(snapshot, transition, { value });
            }

            unit.on('finalize', () => current.clear());
        };

        // Run now if idle, otherwise queue behind the running task
        // (each running task starts the next queued one when it finalizes).
        if (this.unit === null || this.unit._.phase === 'finalized') {
            this.start(Component);
        } else {
            this.queue.push(Component);
        }
        return this;
    }

    private start(Component: Function) {
        this.unit = Unit.create(Unit.currentUnit, Component);
        this.unit.on('finalize', () => {
            // While the owner unit is finalizing, starting the next task would attach a new unit
            // to the dying owner and escape its child-finalize loop, so drop the queue instead.
            const owner = Unit.currentUnit;
            if (this.queue.length > 0 && owner._.phase !== 'finalizing' && owner._.phase !== 'finalized') {
                this.start(this.queue.shift()!);
            } else {
                this.queue = [];
            }
        });
    }
}

