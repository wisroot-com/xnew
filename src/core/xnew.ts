//----------------------------------------------------------------------------------------------------
// xnew — public entry point of the library
// xnew(...) creates a Unit under the currently active Unit (the first call auto-initializes root and
// ticker); each helper acts on the implicit Unit.currentUnit, thinly forwarding to Unit static methods.
//----------------------------------------------------------------------------------------------------

import { Unit, UnitPromise, UnitTimer, ComponentFn, PropsOf } from './unit';
import { DomElement, DomElementDef } from './dom';
import { applyCss, CssDef } from './css';

// Call signatures of xnew(...); a Component only types its props — defines are attached at runtime and reached through Unit's index signature.
export interface XnewBase {
    <C extends ComponentFn<any, any>>(Component: C, props?: PropsOf<C>): Unit;
    <C extends ComponentFn<any, any>>(target: DomElement | string | DomElementDef, Component: C, props?: PropsOf<C>): Unit;
    (target: DomElement | string | DomElementDef, content?: string | number): Unit;
    (parent: Unit | null, ...args: any[]): Unit;
    (): Unit;

    // True when the currently running component is used on its own — not extended onto another component.
    readonly standalone: boolean;
}

export const xnew = Object.assign(
    // Creates a new Unit: xnew((target,) Component?, props?) — a string/number in the Component slot writes text, and needs a target.
    (function(...args: any[]): Unit {
        if (args[0] instanceof Unit) {
            const parent = args.shift() as Unit;
            const snapshot = parent._.lastSnapshot ?? Unit.snapshot(parent);
            return Unit.scope(snapshot, () => new Unit(parent, ...args)) as Unit;
        } else {
            return new Unit(Unit.currentUnit, ...args);
        }
    }) as unknown as XnewBase,
    {
        // Nests a new child element created from a tag string like '<div>' or an element definition object { tag, className?, style?, …members } (with optional text content); only during initialization. In the object form, className / style are embedded (escaped) in the generated tag string; every other member is assigned onto the created element afterwards (property when it exists — value, placeholder, name, checked, … — else setAttribute), and undefined / null / false members are skipped so attributes can be conditional.
        nest(tag: string | DomElementDef, textContent?: string): HTMLElement | SVGElement {
            if (Unit.currentUnit._.phase !== 'invoked') {
                throw new Error('xnew.nest can not be called after initialized.');
            }
            return Unit.nest(Unit.currentUnit, tag, textContent);
        },

        // Extends the current unit with another component; only during initialization. Returns the defines (untyped — see ComponentFn).
        extend<C extends ComponentFn<any, any>>(Component: C, props?: PropsOf<C>): Record<string, any> {
            if (Unit.currentUnit._.phase !== 'invoked') {
                throw new Error('xnew.extend can not be called after initialized.');
            }
            if (Unit.currentUnit._.Components.includes(Component) === true) {
                console.warn('Component is already extended in this unit:', Component);
            }
            return Unit.extend(Unit.currentUnit, Component, props) as Record<string, any>;
        },

        // Registers pseudo-scoped CSS: each key is a local name, always renamed to a page-unique one (scoping is mandatory — invalid keys throw). A string value is a class declaration body wrapped as .xnewN-key { … } (native nesting works inside: &:hover, &[data-checked], @media, …); an at-rule value declares its kind as { rule: '@keyframes' | '@property' | '@counter-style' | '@font-face', body } and hangs the generated name on it ('@property' names become --xnewN-key; '@font-face' injects the name as font-family and body may be an array of faces). $key inside a body references another entry's generated name (unknown references throw; strings / comments pass through untouched, and a body cannot escape its braces). An optional layer (first arg) wraps the whole block in @layer (xbasics passes 'base'). Returns { key: generatedName } to embed in tag strings; the injected <style> is shared per definition and removed when the last unit using it is destroyed.
        css: (function(layerOrDefs: string | Record<string, CssDef>, maybeDefs?: Record<string, CssDef>): Record<string, string> {
            const layer = typeof layerOrDefs === 'string' ? layerOrDefs : undefined;
            const defs = typeof layerOrDefs === 'string' ? maybeDefs! : layerOrDefs;
            return applyCss(Unit.currentUnit, layer, defs);
        }) as {
            <T extends Record<string, CssDef>>(defs: T): Record<keyof T, string>;
            <T extends Record<string, CssDef>>(layer: string, defs: T): Record<keyof T, string>;
        },

        // Returns the nearest unit associated with the given component in the ancestor context chain.
        context(Component: Function): any {
            return Unit.getContext(Unit.currentUnit, Component);
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
            Unit.currentUnit._.promises.push(unitPromise);
            return unitPromise;
        }) as {
            (promise: Function | Promise<any> | Unit): UnitPromise;
            (key: string, promise: Function | Promise<any> | Unit): UnitPromise;
        },

        // Wraps a callback so it later runs in the current unit scope (for external callbacks like setTimeout).
        scope(callback: any): any {
            const snapshot = Unit.snapshot(Unit.currentUnit);
            return (...args: any[]) => Unit.scope(snapshot, callback, ...args);
        },

        // Finds units by component. Options are independent conditions on the found unit: `key` = its reserved prop `key` (assumed globally unique), `ancestor` = that unit is among its ancestors, `parent` = that unit is its direct parent.
        find(Component: Function, options?: { key?: any, ancestor?: Unit, parent?: Unit }): Unit[] {
            return Unit.find(Component, options);
        },

        // Emits a custom event ('+event' = broadcast / '-event' = own unit only); an unprefixed type has no dispatch path, so it throws rather than doing nothing.
        emit(type: string, props?: object): void {
            if (type[0] !== '+' && type[0] !== '-') {
                throw new Error(`xnew.emit: a custom event type must start with "+" (broadcast) or "-" (own unit) [${type}]`);
            }
            return Unit.emit(Unit.currentUnit, type, props);
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

        // Marks the current unit as a protection boundary: from outside, find hides its descendants (the unit itself stays visible) and a '+event' skips the listeners the subtree registered in its own scope — a listener the outside scope registered on a unit inside still fires, since the wall is around the subtree's listeners, not its units.
        protect(): void {
            Unit.currentUnit._.protected = true;
        },

        // Runtime type guard for a Unit (the Unit class is not exposed as a value, so `instanceof xnew.Unit` is impossible).
        isUnit(value: any): value is Unit {
            return value instanceof Unit;
        },

    }
);

// A getter (not a plain member) so it reads Unit.currentUnit at access time; Object.assign would freeze the value.
Object.defineProperty(xnew, 'standalone', {
    get(): boolean {
        return Unit.currentUnit._.standalone;
    },
});

// Merges the type namespace onto the callable value (public types such as xnew.Unit).
export namespace xnew {
    export type Unit = InstanceType<typeof Unit>;
    export type Timer = InstanceType<typeof UnitTimer>;
}

