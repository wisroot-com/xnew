//----------------------------------------------------------------------------------------------------
// Unit — the lifecycle, ownership, and scoping primitive of xnew
//
// A Unit bundles DOM elements, components, children, listeners, and promises into one disposable
// node (invoked → initialized → finalizing → finalized). Deferred callbacks re-enter the original
// unit scope via a Snapshot.
//
// - Unit        : core class — lifecycle, listeners, contexts, emit
// - UnitPromise : promise wrapper resuming in the captured unit scope
// - UnitTimer   : queued timer backing xnew.timeout / interval / transition
//
// Listeners record their owner unit: blanket off(type?) removes only the caller's own, and a
// finalized owner's listeners on other units are detached automatically.
//----------------------------------------------------------------------------------------------------

import { MapSet, MapMap } from './map';
import { Ticker, Timer } from './time';
import { EventBinder, isDomElement, DomElement } from './dom';

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
        promises: UnitPromise[];
        defines: Record<string, any>;
        systems: Record<'update' | 'finalize', { listener: Function, execute: Function, count: number, owner: Unit }[]>;

        currentElement: DomElement;
        currentContext: Context;
        currentComponent: Function | null;

        lastSnapshot: Snapshot | null;

        nestElements: { element: DomElement, owned: boolean }[];
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
        } else if (typeof args[0] === 'string') {
            Unit.nest(unit, args.shift() as string);
        }

        const Component = args[0] as Function | string | number | undefined;
        const props = args[1] as Object | undefined;

        let baseComponent: Function;
        if (typeof Component === 'function') {
            baseComponent = Component;
        } else if (typeof Component === 'string' || typeof Component === 'number') {
            baseComponent = (unit: Unit) => { unit.element.textContent = Component.toString(); };
        } else {
            baseComponent = (unit: Unit) => {};
        }

        unit._.key = (props as any)?.key ?? null;

        const backup = Unit.currentUnit;
        Unit.currentUnit = unit;

        Unit.extend(unit, baseComponent, props);

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
            Unit.offAll(this);

            [...this._.nestElements].reverse().filter(item => item.owned).forEach(item => item.element.remove());
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

    static nest(unit: Unit, target: DomElement | string, textContent?: string | number): DomElement {
        if (isDomElement(target)) {
            unit._.nestElements.push({ element: target, owned: false });
            unit._.currentElement = target;
            return target;
        } else {
            const match = target.match(/<((\w+)[^>]*?)\/?>/);
            if (match !== null) {
                unit._.currentElement.insertAdjacentHTML('beforeend', `<${match[1]}></${match[2]}>`);
                const element = unit._.currentElement.children[unit._.currentElement.children.length - 1] as DomElement;
                unit._.currentElement = element;
                if (textContent !== undefined) {
                    element.textContent = textContent.toString();
                }
                unit._.nestElements.push({ element, owned: true });
                return element;
            } else {
                throw new Error(`xnew.nest: invalid tag string [${target}]`);
            }
        }
    }

    static extend(unit: Unit, Component: Function, props?: Object): { [key: string]: any } {
        const backupComponent = unit._.currentComponent;
        unit._.currentComponent = Component;

        if (unit._.parent !== null) {
            Unit.addContext(unit._.parent, unit, Component, unit);
        }
        Unit.addContext(unit, unit, Component, unit);

        const defines = Component(unit, props ?? {}) ?? {};

        unit._.currentComponent = backupComponent;

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
            unit._.systems.update.forEach((entry) => entry.execute({ count: entry.count++, delta }));
        }
    }

    static engineRoot: Unit;
    static currentUnit: Unit;
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

    public off(type?: string, listener?: Function): void {
        const types = typeof type === 'string' ? type.trim().split(/\s+/) : [...this._.listeners.keys(), 'update', 'finalize'];

        types.forEach((type) => Unit.off(this, type, listener));
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

    // blanket off (no listener) removes only the caller's own entries; off(type, listener) ignores owner
    static off(unit: Unit, type: string, listener?: Function): void {
        const owner = Unit.currentUnit;
        Unit.remove(unit, type, (lis, own) => listener !== undefined ? lis === listener : own === owner);
    }

    // finalize-only: clear all listeners on this unit, and detach those it registered on other units
    static offAll(unit: Unit): void {
        Unit.owner2targets.get(unit)?.forEach((target) => {
            [...target._.listeners.keys(), 'update', 'finalize'].forEach((type) => Unit.remove(target, type, (_, own) => own === unit));
        });
        Unit.owner2targets.delete(unit);

        [...unit._.listeners.keys(), 'update', 'finalize'].forEach((type) => Unit.remove(unit, type, () => true));
    }

    // remove the entries of `type` whose (listener, owner) matches; shared by off / offAll
    static remove(unit: Unit, type: string, match: (listener: Function, owner: Unit) => boolean): void {
        if (type === 'update' || type === 'finalize') {
            unit._.systems[type] = unit._.systems[type].filter((entry) => match(entry.listener, entry.owner) === false);
        } else {
            [...(unit._.listeners.get(type)?.entries() ?? [])].forEach(([listener, item]) => {
                if (match(listener, item.owner)) {
                    unit._.listeners.delete(type, listener);
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
    public then(callback: Function): UnitPromise {
        return this.chain('then', callback);
    }
    public catch(callback: Function): UnitPromise {
        return this.chain('catch', callback);
    }
    public finally(callback: Function): UnitPromise {
        return this.chain('finally', callback);
    }

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
        const timer = this;
        const snapshot = Unit.snapshot(Unit.currentUnit);

        // Timer parameters are captured by closure, not passed as props.
        const Component = (unit: Unit) => {
            let counter = 0;
            let current = new Timer(onTimeout, onTransition, duration, easing);

            function onTimeout() {
                if (timeout) Unit.scope(snapshot, timeout, { timer });
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
                if (transition) Unit.scope(snapshot, transition, { value, timer });
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

