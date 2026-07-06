//----------------------------------------------------------------------------------------------------
// xnew — public entry point of the library
//
// xnew(...) creates a new Unit as a child of the currently active Unit (the first call auto-initializes
// root and ticker). Each helper acts on the implicit Unit.current, so it is called from inside a
// component function; the implementation is a thin forward to Unit static methods.
//
// - xnew.nest / extend                   : extend the unit under initialization
// - xnew.find / context                  : search by component / resolve ancestor context
// - xnew.promise                         : register a promise to the unit (xnew.promise(unit) aggregates its results)
// - xnew.scope / emit / protect          : scope capture / '+global' '-local' events / visibility boundary
// - xnew.timeout / interval / transition : scheduling via UnitTimer
// - xnew.{Unit,Component}                : public types (type namespace merged onto the callable value)
//----------------------------------------------------------------------------------------------------

import { Unit, UnitPromise, UnitTimer, ComponentFn, DefinesOf, PropsOf } from './unit';
import { DomElement } from './dom';

// Call signatures of xnew(...); passing a Component merges its defines into the return type.
export interface XnewBase {
    <C extends ComponentFn<any, any>>(Component: C, props?: PropsOf<C>): Unit & DefinesOf<C>;
    <C extends ComponentFn<any, any>>(target: DomElement | string, Component: C, props?: PropsOf<C>): Unit & DefinesOf<C>;
    (target: DomElement | string, content?: string | number): Unit;
    (content: string | number): Unit;
    (parent: Unit | null, ...args: any[]): Unit;
    (): Unit;
}

export const xnew = Object.assign(
    // Creates a new Unit: xnew((target,) Component?, props?) — target is an element or a tag string like '<div>'.
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
        // Nests a child element (an existing element or a tag string like '<div>'); only during initialization.
        nest(target: DomElement | string): HTMLElement | SVGElement {
            if (Unit.current._.phase !== 'invoked') {
                throw new Error('xnew.nest can not be called after initialized.');
            }
            return Unit.nest(Unit.current, target);
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

        // Runs callback({ timer }) once after duration ms (the timer follows the unit lifecycle; timer.clear() aborts).
        timeout(callback: Function, duration: number = 0): UnitTimer {
            return new UnitTimer().timeout(callback, duration);
        },

        // Runs callback({ timer }) every duration ms, iterations times (0 = infinite; timer.clear() stops).
        interval(callback: Function, duration: number, iterations: number = 0): UnitTimer {
            return new UnitTimer().interval(callback, duration, iterations);
        },

        // Runs transition({ value: 0→1, timer }) over duration ms (easing: 'linear'|'ease'|'ease-in'|'ease-out'|'ease-in-out'; chainable).
        transition(transition: Function, duration: number = 0, easing: string = 'linear'): UnitTimer {
            return new UnitTimer().transition(transition, duration, easing);
        },

        // Marks the current unit as a protection boundary: descendants are hidden from '+event' emit / find outside the subtree (the unit itself stays visible).
        protect(): void {
            Unit.current._.protected = true;
        },

    }
);

// Merges the type namespace onto the callable value (public types such as xnew.Unit).
export namespace xnew {
    export type Unit = InstanceType<typeof Unit>;
    export type Component<P extends object = any, A extends object = {}> = ComponentFn<P, A>;
}

