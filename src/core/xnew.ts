//----------------------------------------------------------------------------------------------------
// xnew — public entry point of the library
// xnew(...) creates a Unit under the currently active Unit (the first call auto-initializes root and
// ticker); each helper acts on the implicit Unit.current, thinly forwarding to Unit static methods.
//----------------------------------------------------------------------------------------------------

import { Unit, UnitPromise, UnitTimer, ComponentFn, DefinesOf, PropsOf } from './unit';
import { DomElement, DomElementDef } from './dom';
import { applyCss } from './css';

// Call signatures of xnew(...); passing a Component merges its defines into the return type.
export interface XnewBase {
    <C extends ComponentFn<any, any>, E extends ComponentFn<any, any>>(Base: C, props: PropsOf<C>, ExComponent: E): Unit & DefinesOf<C> & DefinesOf<E>;
    <C extends ComponentFn<any, any>, E extends ComponentFn<any, any>>(Base: C, ExComponent: E): Unit & DefinesOf<C> & DefinesOf<E>;
    <C extends ComponentFn<any, any>>(Base: C, props: PropsOf<C>, content: string | number): Unit & DefinesOf<C>;
    <C extends ComponentFn<any, any>>(Base: C, content: string | number): Unit & DefinesOf<C>;
    <C extends ComponentFn<any, any>>(Component: C, props?: PropsOf<C>): Unit & DefinesOf<C>;
    <C extends ComponentFn<any, any>, E extends ComponentFn<any, any>>(target: DomElement | string | DomElementDef, Base: C, props: PropsOf<C>, ExComponent: E): Unit & DefinesOf<C> & DefinesOf<E>;
    <C extends ComponentFn<any, any>, E extends ComponentFn<any, any>>(target: DomElement | string | DomElementDef, Base: C, ExComponent: E): Unit & DefinesOf<C> & DefinesOf<E>;
    <C extends ComponentFn<any, any>>(target: DomElement | string | DomElementDef, Base: C, props: PropsOf<C>, content: string | number): Unit & DefinesOf<C>;
    <C extends ComponentFn<any, any>>(target: DomElement | string | DomElementDef, Base: C, content: string | number): Unit & DefinesOf<C>;
    <C extends ComponentFn<any, any>>(target: DomElement | string | DomElementDef, Component: C, props?: PropsOf<C>): Unit & DefinesOf<C>;
    (target: DomElement | string | DomElementDef, content?: string | number): Unit;
    (content: string | number): Unit;
    (parent: Unit | null, ...args: any[]): Unit;
    (): Unit;

    // True when the component whose body is currently running is composed by its caller: it carries a trailing
    // ExComponent (xnew(Base, props, fn)) or is itself extended onto another component (xnew.extend(Base)).
    readonly composed: boolean;
}

export const xnew = Object.assign(
    // Creates a new Unit: xnew((target,) Component?, props?) — target is an element or a tag string like '<div>'.
    // A trailing function after a Component is an extension component extended on top of it: xnew(Base, props?, (unit) => { … }).
    (function(...args: any[]): Unit {
        if (args[0] instanceof Unit) {
            const parent = args.shift() as Unit;
            const snapshot = parent._.lastSnapshot ?? Unit.snapshot(parent);
            return Unit.scope(snapshot, () => Unit.create(parent, ...args)) as Unit;
        } else {
            return Unit.create(Unit.current, ...args);
        }
    }) as unknown as XnewBase,
    {
        // Nests a new child element created from a tag string like '<div>' or an element definition object { tag, className?, style?, …members } (with optional text content); only during initialization. In the object form, className / style are embedded (escaped) in the generated tag string; every other member is assigned onto the created element afterwards (property when it exists — value, placeholder, name, checked, … — else setAttribute), and undefined / null / false members are skipped so attributes can be conditional.
        nest(tag: string | DomElementDef, textContent?: string): HTMLElement | SVGElement {
            if (Unit.current._.phase !== 'invoked') {
                throw new Error('xnew.nest can not be called after initialized.');
            }
            return Unit.nest(Unit.current, tag, textContent);
        },

        // Extends the current unit with another component; only during initialization. Returns the defines.
        extend<C extends ComponentFn<any, any>>(Component: C, props?: PropsOf<C>): DefinesOf<C> {
            if (Unit.current._.phase !== 'invoked') {
                throw new Error('xnew.extend can not be called after initialized.');
            }
            if (Unit.current._.Components.includes(Component) === true) {
                console.warn('Component is already extended in this unit:', Component);
            }
            return Unit.extend(Unit.current, Component, props) as DefinesOf<C>;
        },

        // Registers pseudo-scoped CSS: each key is a local name, always renamed to a page-unique one (scoping is mandatory — invalid keys throw). A value is a CSS fragment string: a declaration body, wrapped as .xnewN-key { … } (native nesting works inside, e.g. &:hover / &[data-checked]), or a nameless at-rule "@type { … }" that hangs the generated name on it (@keyframes { … } → @keyframes xnewN-key; a name inside throws, so scoping holds). $key inside a body references another entry's generated name (unknown references throw). An optional layer (first arg) wraps the whole block in @layer (xbasics passes 'base'). Returns { key: generatedName } to embed in tag strings; the injected <style> is shared per definition and removed when the last unit using it finalizes.
        css: (function(layerOrDefs: string | Record<string, string>, maybeDefs?: Record<string, string>): Record<string, string> {
            const layer = typeof layerOrDefs === 'string' ? layerOrDefs : undefined;
            const defs = typeof layerOrDefs === 'string' ? maybeDefs! : layerOrDefs;
            return applyCss(Unit.current, layer, defs);
        }) as {
            <T extends Record<string, string>>(defs: T): Record<keyof T, string>;
            <T extends Record<string, string>>(layer: string, defs: T): Record<keyof T, string>;
        },

        // Returns the nearest unit associated with the given component in the ancestor context chain.
        context(key: any): any {
            return Unit.getContext(Unit.current, key);
        },
            
        // Registers a promise to the current unit (optional string key first). Accepts an executor (resolve, reject), a raw Promise, or a Unit — a Unit aggregates its keyed results without consuming its pool.
        promise: (function (keyOrPromise?: any, maybePromise?: any): UnitPromise {
            const key = typeof keyOrPromise === 'string' ? keyOrPromise : undefined;
            const promise = typeof keyOrPromise === 'string' ? maybePromise : keyOrPromise;
            if (key !== undefined && /^.+\[\d+\]$/.test(key)) {
                throw new Error(`xnew.promise: indexed key "${key}" is no longer supported; use "${key.replace(/\[\d+\]$/, '[]')}" to append in registration order`);
            }
            // collect snapshots the pool at registration time, so later additions do not join an in-flight aggregation
            let source: any;
            if (promise instanceof Unit) {
                source = UnitPromise.collect(promise._.promises);
            } else if (promise instanceof Promise) {
                source = promise;
            } else {
                source = new Promise(xnew.scope(promise));
            }
            const unitPromise = new UnitPromise(source, key);
            Unit.current._.promises.push(unitPromise);
            return unitPromise;
        }) as {
            (promise: Function | Promise<any> | Unit): UnitPromise;
            (key: string, promise: Function | Promise<any> | Unit): UnitPromise;
        },

        // Wraps a callback so it later runs in the current unit scope (for external callbacks like setTimeout).
        scope(callback: any): any {
            const snapshot = Unit.snapshot(Unit.current);
            return (...args: any[]) => Unit.scope(snapshot, callback, ...args);
        },

        // Finds units by component. opts.key narrows by the reserved prop `key` (assumed globally unique).
        find(Component: Function, opts?: { key?: any }): Unit[] {
            return Unit.find(Component, opts?.key);
        },

        // Emits a custom event ('+event' = broadcast / '-event' = own unit only).
        emit(type: string, ...args: any[]): void {
            return Unit.emit(Unit.current, type, ...args);
        },

        // Runs callback({ count }) once after duration ms (the timer follows the unit lifecycle; timer.clear() aborts).
        timeout(callback: Function, duration: number = 0): UnitTimer {
            return new UnitTimer().timeout(callback, duration);
        },

        // Runs callback({ count }) every duration ms, iterations times (0 = infinite; count starts at 0; timer.clear() stops).
        interval(callback: Function, duration: number, iterations: number = 0): UnitTimer {
            return new UnitTimer().interval(callback, duration, iterations);
        },

        // Runs transition({ value: 0→1 }) over duration ms (easing: 'linear'|'ease'|'ease-in'|'ease-out'|'ease-in-out'; chainable).
        transition(transition: Function, duration: number = 0, easing: string = 'linear'): UnitTimer {
            return new UnitTimer().transition(transition, duration, easing);
        },

        // Marks the current unit as a protection boundary: descendants are hidden from '+event' emit / find outside the subtree (the unit itself stays visible).
        protect(): void {
            Unit.current._.protected = true;
        },

        // The Unit class itself, exposed as a runtime value so callers can test `x instanceof xnew.Unit`.
        Unit,

    }
);

// A getter (not a plain member) so it reads Unit.current at access time; Object.assign would freeze the value.
Object.defineProperty(xnew, 'composed', {
    get(): boolean {
        return Unit.current._.composed;
    },
});

// Merges the type namespace onto the callable value (public types such as xnew.Unit).
export namespace xnew {
    export type Unit = InstanceType<typeof Unit>;
    export type Component<P extends object = any, A extends object = {}> = ComponentFn<P, A>;
    export type ElementDef = DomElementDef;
}

