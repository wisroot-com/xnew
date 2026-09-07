//----------------------------------------------------------------------------------------------------
// Unit — the lifecycle, ownership, and scoping primitive of xnew
// A Unit bundles DOM, components, children, listeners, and promises into one disposable node;
// listeners record their owner, so a finalized owner's listeners elsewhere detach automatically.
//----------------------------------------------------------------------------------------------------

import { MapSet } from './map';
import { Ticker, Timer } from './time';
import { EventBinder, isDomElement, DomElement, DomElementDef, isElementDef, createElement } from './dom';

//----------------------------------------------------------------------------------------------------
// definitions
//----------------------------------------------------------------------------------------------------

interface Context { previous: Context | null; Component?: Function; value?: any; }

interface Snapshot { unit: Unit; context: Context; element: DomElement; Component: Function | null; }

// one entry per on() call: keyed by the pair, so two units may share one handler function
interface ListenerEntry { listener: Function; execute: Function; owner: Unit; }

// engine-dispatched lifecycle events: they live in _.systems, so they never reach addEventListener nor need the '+' / '-' prefix
export type SystemType = 'update' | 'finalize' | 'childattach' | 'childdetach';
const SYSTEM_TYPES: SystemType[] = ['update', 'finalize', 'childattach', 'childdetach'];

// xsync node record (see src/sync): every unit carries one; root is the sync root it lives under (null outside one) and is inherited, the rest is per-unit.
export interface SyncData { root: Unit | null; id: number | null; state: Record<string, any>; registry: Record<string, Function>; visibility: ((clientId: string) => boolean) | null; }

// Component function type; the returned defines are merged into the xnew(...) return value (Unit & A).
export type ComponentFn<P extends object = any, A extends object = {}> = (unit: Unit, props: P) => A | void;

// Extract the defines type of a Component (void falls back to {}).
export type DefinesOf<C> = C extends (...args: any[]) => infer R ? ([R] extends [void] ? {} : Exclude<R, void | undefined>) : {};

// Extract the props type of a Component ({} if absent).
export type PropsOf<C> = C extends (unit: Unit, props: infer P, ...rest: any[]) => any ? P : {};

// Component that writes a text/number literal into the element; only reachable with a target (see the constructor).
function textComponent(content: string | number): (unit: Unit) => void {
    return (unit: Unit) => { unit.current.textContent = content.toString(); };
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
        attached: boolean;   // childattach has fired on the parent; keeps the childattach / childdetach pair balanced
        protected: boolean;
        standalone: boolean;
        promises: UnitPromise[];
        defines: Record<string, any>;
        systems: Record<SystemType, { listener: Function, execute: Function, count: number, owner: Unit }[]>;

        currentElement: DomElement;
        currentContext: Context;
        currentComponent: Function | null;

        lastSnapshot: Snapshot | null;

        nestElements: DomElement[];
        Components: Function[];
        listeners: MapSet<string, ListenerEntry>;
        events: EventBinder;

        key: any;   // reserved prop for find(key) (global unique assumed)
        sync: SyncData;   // reserved slot for xsync; the root and any node seed are stamped from outside via the _hook prop, descendants inherit the root
    };

    constructor(parent: Unit | null, ...args: any[]) {
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
            attached: false,
            protected: false,
            standalone: true,
            currentElement: baseElement,
            currentContext: baseContext,
            currentComponent: null,
            lastSnapshot: null,
            children: [],
            nestElements: [],
            promises: [],
            Components: [],
            listeners: new MapSet(),
            defines: {},
            systems: { update: [], finalize: [], childattach: [], childdetach: [] },
            events: new EventBinder(),
            key: null,
            sync: { root: parent?._.sync.root ?? null, id: null, state: {}, registry: {}, visibility: null },
        };

        let targeted = false;
        if (isDomElement(args[0])) {
            this._.currentElement = args.shift() as DomElement;
            targeted = true;
        } else if (typeof args[0] === 'string' || isElementDef(args[0]) === true) {
            Unit.nest(this, args.shift() as string | DomElementDef);
            targeted = true;
        }

        // xnew(Component, props?): pull off the component, then optional props.
        const Component = args.shift() as Function | string | number | undefined;

        let props: Object | undefined;
        if (typeof args[0] === 'object') {
            props = args.shift() as Object | undefined;
        }

        let baseComponent: Function;
        if (typeof Component === 'function') {
            baseComponent = Component;
        } else if (typeof Component === 'string' || typeof Component === 'number') {
            // without a target the literal would overwrite the borrowed parent element, wiping its children
            if (targeted === false) {
                throw new Error(`xnew: text content needs a target element [${Component}]`);
            }
            baseComponent = textComponent(Component);
        } else {
            baseComponent = (unit: Unit) => {};
        }

        this._.key = (props as any)?.key ?? null;

        // reserved library-internal prop: lets the layer that created this unit stamp it (see src/sync) before the component body runs, so the body and its descendants see the result from birth
        if (typeof (props as any)?._hook === 'function') {
            (props as any)._hook(this);
        }

        const backup = Unit.currentUnit;
        Unit.currentUnit = this;

        Unit.extend(this, baseComponent, props);

        if (this._.phase === 'invoked') {
            this._.phase = 'initialized';
        }
        this._.lastSnapshot = Unit.snapshot(this);
        Unit.currentUnit = backup;

        // fired once the constructor is done, so listeners see a fully built child (a unit finalized inside its own component body never attaches, nor detaches); iterate a copy, since a listener may add / remove listeners mid-dispatch
        if (parent !== null && this._.phase !== 'finalized') {
            this._.attached = true;
            [...parent._.systems.childattach].forEach((entry) => entry.execute({ child: this }));
        }
    }

    public get parent(): Unit | null {
        return this._.parent;
    }
    
    // the element new children attach to: the innermost element the unit nested, or the one it was created on
    public get current(): DomElement {
        return this._.currentElement;
    }

    // the unit's own outermost element: null when it nested none and merely borrows the element it was created on
    public get container(): DomElement | null {
        return this._.nestElements[0] ?? null;
    }

    public finalize(): void {
        if (this._.phase !== 'finalized' && this._.phase !== 'finalizing') {
            this._.phase = 'finalizing';

            [...this._.children].reverse().forEach((child: Unit) => child.finalize());
            [...this._.systems.finalize].reverse().forEach(({ execute }) => execute());

            // detach the listeners this unit registered on other units
            Unit.owner2targets.get(this)?.forEach((target) => {
                [...target._.listeners.keys(), ...SYSTEM_TYPES].forEach((type) => Unit.off(target, this, type));
                Unit.target2owners.delete(target, this);
            });
            Unit.owner2targets.delete(this);

            // and drop itself from every owner's target set — a finalized target left there pins its whole _ bag
            Unit.target2owners.get(this)?.forEach((owner) => Unit.owner2targets.delete(owner, this));
            Unit.target2owners.delete(this);

            // clear all listeners on this unit regardless of owner
            [...this._.listeners.keys(), ...SYSTEM_TYPES].forEach((type) => Unit.off(this, null, type));

            [...this._.nestElements].reverse().forEach((element) => element.remove());
            this._.Components.forEach((Component) => Unit.component2units.delete(Component, this));

            // remove contexts
            const contexts = Unit.unit2Contexts.get(this);
            contexts?.forEach((context: Context) => {
                let temp = context.previous;
                while(temp !== null) {
                    if (contexts.has(temp) === false && temp.Component !== undefined) {
                        context.previous = temp;
                        context.Component = undefined;
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

            const parent = this._.parent;
            if (parent !== null) {
                parent._.children = parent._.children.filter((u: Unit) => u !== this);
            }
            this._.phase = 'finalized';

            // fired after the child is fully finalized; it reaches the parent during the parent's own cascade too, since the parent clears its listeners only after its children
            if (parent !== null && this._.attached === true) {
                [...parent._.systems.childdetach].forEach((entry) => entry.execute({ child: this }));
            }
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
        const backupStandalone = unit._.standalone;
        // standalone is scoped to this invocation (restored on exit) so a component's own inner xnew.extend never flips its value
        unit._.standalone = backupComponent === null;
        unit._.currentComponent = Component;

        if (unit._.parent !== null) {
            Unit.addContext(unit._.parent, unit, Component, unit);
        }
        Unit.addContext(unit, unit, Component, unit);

        const defines = Component(unit, props ?? {}) ?? {};

        unit._.currentComponent = backupComponent;
        unit._.standalone = backupStandalone;

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

    // Drives only initialized units; listeners receive { count, delta } (count per registration, delta ms since the previous frame).
    static update(unit: Unit, delta: number = 0): void {
        if (unit._.phase === 'initialized') {
            unit._.children.forEach((child: Unit) => Unit.update(child, delta));
            // iterate a copy: a listener may remove itself (once / off) mid-dispatch
            [...unit._.systems.update].forEach((entry) => entry.execute({ count: entry.count++, delta }));
        }
    }

    static engineRoot: Unit;
    static currentUnit: Unit;

    static reset(): void {
        Unit.engineRoot?.finalize();
        Unit.currentUnit = Unit.engineRoot = new Unit(null);
        // unref'd: the root ticker starts at import time, so it must not keep a Node process alive on its own
        const ticker = new Ticker((delta: number) => {
            Unit.update(Unit.engineRoot, delta);
        }, 60, true);
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

    static addContext(unit: Unit, orner: Unit, Component: Function, value?: any): void {
        unit._.currentContext = { previous: unit._.currentContext, Component, value };
        Unit.unit2Contexts.add(orner, unit._.currentContext);
    }

    static getContext(unit: Unit, Component: Function): any {
        for (let context = unit._.currentContext; context.previous !== null; context = context.previous) {
            if (context.value === Unit.currentUnit && Component === unit._.currentComponent) continue;
            if (Component === context.Component) return context.value;
        }
    }

    static component2units: MapSet<Function, Unit> = new MapSet();

    // Ancestor chain (excluding unit itself).
    static ancestors(unit: Unit | null): Unit[] {
        const ancestors: Unit[] = [];
        for (let u = unit?._.parent ?? null; u !== null; u = u._.parent) ancestors.push(u);
        return ancestors;
    }

    // Visibility across protect boundaries: visible unless `from` has a protected ancestor that is neither `current` nor one of its ancestors.
    static isVisible(from: Unit | null, current: Unit | null, ancestors: Unit[]): boolean {
        let boundary: Unit | undefined;
        for (let u = from; u !== null; u = u._.parent) {
            if (u._.protected === true) { boundary = u; break; }
        }
        return boundary === undefined || ancestors.includes(boundary) === true || current === boundary;
    }

    // every option is an independent predicate on the found unit, so any combination is valid (they AND together).
    static find(Component: Function, options: { key?: any, ancestor?: Unit, parent?: Unit } = {}): Unit[] {
        const current = Unit.currentUnit;
        const ancestors = Unit.ancestors(current);
        return [...(Unit.component2units.get(Component) ?? [])].filter((unit) => {
            if (options.key !== undefined && unit._.key !== options.key) {
                return false;
            } else if (options.ancestor !== undefined && Unit.ancestors(unit).includes(options.ancestor) === false) {
                return false;
            } else if (options.parent !== undefined && unit._.parent !== options.parent) {
                return false;
            } else {
                return Unit.isVisible(unit._.parent, current, ancestors);
            }
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
        const types = typeof type === 'string' ? type.trim().split(/\s+/) : [...this._.listeners.keys(), ...SYSTEM_TYPES];

        types.forEach((type) => Unit.off(this, Unit.currentUnit, type, listener));
    }
    
    // owner (the unit whose scope called on) → the units it registered listeners on, and its inverse
    static owner2targets = new MapSet<Unit, Unit>();
    static target2owners = new MapSet<Unit, Unit>();

    static on(unit: Unit, type: string, listener: Function, options?: boolean | AddEventListenerOptions): void {
        const owner = Unit.currentUnit;
        const snapshot = Unit.snapshot(owner);
        const execute = (props: object = {}) => {
            Unit.scope(snapshot, listener, Object.assign({ type }, props));
        }
        if (SYSTEM_TYPES.includes(type as SystemType)) {
            // lifecycle-only: registered in systems, never in the dispatch path (listeners / type2units / events).
            unit._.systems[type as SystemType].push({ listener, execute, count: 0, owner });
        } else if (Unit.registered(unit, type, listener, owner) === false) {
            unit._.listeners.add(type, { listener, execute, owner });
            Unit.type2units.add(type, unit);
            if (/^[A-Za-z]/.test(type) && unit.current !== null) {
                unit._.events.add(unit.current, type, execute, options);
            }
        }
        if (owner !== unit) {
            Unit.owner2targets.add(owner, unit);
            Unit.target2owners.add(unit, owner);
        }
    }

    // true when `owner` already registered exactly this listener for this type (the same pair must not stack)
    static registered(unit: Unit, type: string, listener: Function, owner: Unit): boolean {
        return [...(unit._.listeners.get(type) ?? [])].some((entry) => entry.listener === listener && entry.owner === owner);
    }

    // remove the entries that `owner` registered (owner: null matches any owner; listener narrows further)
    static off(unit: Unit, owner: Unit | null, type: string, listener?: Function): void {
        const match = (lis: Function, own: Unit) => (owner === null || own === owner) && (listener === undefined || lis === listener);
        if (SYSTEM_TYPES.includes(type as SystemType)) {
            const system = type as SystemType;
            unit._.systems[system] = unit._.systems[system].filter((entry) => match(entry.listener, entry.owner) === false);
        } else {
            [...(unit._.listeners.get(type) ?? [])].forEach((entry) => {
                if (match(entry.listener, entry.owner)) {
                    unit._.listeners.delete(type, entry);
                    if (/^[A-Za-z]/.test(type)) {
                        unit._.events.remove(type, entry.execute);
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
            // iterate copies: a listener may add / remove listeners mid-dispatch (as Unit.update does)
            [...(Unit.type2units.get(type) ?? [])].forEach((target) => {
                if (Unit.isVisible(target, unit, ancestors)) {
                    [...(target._.listeners.get(type) ?? [])].forEach((entry) => entry.execute(props));
                }
            });
        } else if (type[0] === '-') {
            [...(unit._.listeners.get(type) ?? [])].forEach((entry) => entry.execute(props));
        }
    }

    // Boot the engine as part of evaluating the class, so Unit.currentUnit is never undefined and callers
    // need no lazy guard. A bare `Unit.reset()` at module scope would be fair game for a bundler to drop
    // (package.json declares "sideEffects": false); a static block belongs to the class every consumer uses.
    // It has to sit last in the body: reset() builds a Unit, which touches static maps declared above, and
    // static initializers run in textual order.
    static {
        Unit.reset();
    }
}

//----------------------------------------------------------------------------------------------------
// extensions
//----------------------------------------------------------------------------------------------------

export class UnitPromise {
    constructor(private promise: Promise<any>, public key?: string) {}

    // then / catch / finally run the callback in the captured scope; a returned UnitPromise unwraps to its inner promise.
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

    // Aggregate promises into one object: keyed entries are included (a `name[]` key pushes in registration order), unkeyed ones only awaited.
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

        // Run now if idle, otherwise queue behind the running task (each task starts the next queued one when it finalizes).
        if (this.unit === null || this.unit._.phase === 'finalized') {
            this.start(Component);
        } else {
            this.queue.push(Component);
        }
        return this;
    }

    private start(Component: Function) {
        this.unit = new Unit(Unit.currentUnit, Component);
        this.unit.on('finalize', () => {
            // While the owner unit is finalizing, the next task would escape its child-finalize loop — drop the queue instead.
            const owner = Unit.currentUnit;
            if (this.queue.length > 0 && owner._.phase !== 'finalizing' && owner._.phase !== 'finalized') {
                this.start(this.queue.shift()!);
            } else {
                this.queue = [];
            }
        });
    }
}

