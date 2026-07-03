//----------------------------------------------------------------------------------------------------
// Unit — the lifecycle, ownership, and scoping primitive of xnew
//
// Unit は DOM 要素・Component・子 unit・リスナ・promise を 1 つに束ね、状態機械
// invoked → initialized → finalizing → finalized で駆動する。initialized が実行状態で、
// update はそこで走る（一時停止/再開の概念は持たない）。
// 遅延コールバック（DOM イベント・timer・promise 継続）は Snapshot 経由で Unit.scope に再入し、
// 非同期を跨いでも元のコンポーネント内にいるかのように実行される。
//
// - Unit        : core class — lifecycle, listeners, contexts, emit
// - UnitPromise : 元の Unit スコープで再開する promise ラッパー。.then / .catch / .finally は
//                 捕捉スコープで callback を実行し、戻り値をチェーン値にする素のチェーン
//                 （非同期継続は return new Promise で表す）。集約リザルトは xnew.promise(unit)
//                 で取得する（集約しても対象 unit のプールは消費しない）。
// - UnitTimer   : xnew.timeout / interval / transition が使うキュー式タイマー
//----------------------------------------------------------------------------------------------------

import { MapSet, MapMap } from './map';
import { Ticker, Timer } from './time';
import { Eventor, isDomElement, DomElement } from './dom';

//----------------------------------------------------------------------------------------------------
// definitions
//----------------------------------------------------------------------------------------------------

interface Context { previous: Context | null; key?: any; value?: any; }

interface Snapshot { unit: Unit; context: Context; element: DomElement; Component: Function | null; }

// lifecycle phase: invoked → initialized → finalizing → finalized
type Status = 'invoked' | 'initialized' | 'finalizing' | 'finalized';

// Component 関数の型。戻り値 defines は xnew(...) の戻り値に合成される(Unit & A)。
export type ComponentFn<P extends object = any, A extends object = {}> =
    (unit: Unit, props: P) => A | void;

// Component の defines 型を取り出す（void は {} に落とす）。
export type DefinesOf<C> =
    C extends (...args: any[]) => infer R
        ? ([R] extends [void] ? {} : Exclude<R, void | undefined>)
        : {};

// Component の props 型を取り出す（無い場合は {}）。
export type PropsOf<C> =
    C extends (unit: Unit, props: infer P, ...rest: any[]) => any ? P : {};

type SystemEvent = 'update' | 'finalize';

//----------------------------------------------------------------------------------------------------
// unit
//----------------------------------------------------------------------------------------------------

export class Unit {
    [key: string]: any;

    public _: {
        id: number;
        parent: Unit | null;
        children: Unit[];

        status: Status;
        protected: boolean;
        promises: UnitPromise[];
        defines: Record<string, any>;
        // update / finalize の唯一の登録先（listeners とは別経路で、emit / sync の dispatch には載らない）。
        // count はリスナ登録ごとに保持する（そのリスナが呼ばれた回数。後から登録したものは 0 始まり）。
        systems: Record<SystemEvent, { listener: Function, execute: Function, count: number }[]>;

        currentElement: DomElement;
        currentContext: Context;
        currentComponent: Function | null;

        lastSnapshot: Snapshot | null;

        nestElements: { element: DomElement, owned: boolean }[];
        Components: Function[];
        listeners: MapMap<string, Function, { element: DomElement, Component: Function | null, execute: Function }>;
        eventor: Eventor;

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
            id: Unit.nextId++,
            parent,
            status: 'invoked',
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
            eventor: new Eventor(),
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

        if (unit._.status === 'invoked') {
            unit._.status = 'initialized';
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
        Unit.finalize(this);
    }

    static finalize(unit: Unit): void {
        if (unit._.status !== 'finalized' && unit._.status !== 'finalizing') {
            unit._.status = 'finalizing';

            [...unit._.children].reverse().forEach((child: Unit) => child.finalize());
            [...unit._.systems.finalize].reverse().forEach(({ execute }) => execute());
            unit.off();

            [...unit._.nestElements].reverse().filter(item => item.owned).forEach(item => item.element.remove());
            unit._.Components.forEach((Component) => Unit.component2units.delete(Component, unit));
            
            // remove contexts
            const contexts = Unit.unit2Contexts.get(unit);
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
            Unit.unit2Contexts.delete(unit);
            unit._.currentContext = { previous: null };

            Object.keys(unit._.defines).forEach((key) => {
                delete unit[key];
            });
            unit._.defines = {};
            unit._.status = 'finalized';

            if (unit._.parent) {
                unit._.parent._.children = unit._.parent._.children.filter((u: Unit) => u !== unit);
            }
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

    // count = そのリスナが呼ばれた回数（登録後 0 始まり）, delta = 前フレームからの経過 ms。
    // リスナは ({ count, delta }) で受け取れる。count はリスナ登録ごとに独立し、
    // 後から登録したリスナは 0 から数え始める。initialized になった unit のみ駆動する。
    static update(unit: Unit, delta: number = 0): void {
        if (unit._.status === 'initialized') {
            unit._.children.forEach((child: Unit) => Unit.update(child, delta));
            unit._.systems.update.forEach((entry) => entry.execute({ count: entry.count++, delta }));
        }
    }

    static engineRoot: Unit;
    static currentUnit: Unit;
    static nextId: number = 0;   // unit ごとに 0 から順番に採番する id（reset でリセット）
    static reset(): void {
        Unit.engineRoot?.finalize();
        Unit.nextId = 0;
        Unit.currentUnit = Unit.engineRoot = Unit.create(null);
        const ticker = new Ticker((delta: number) => {
            Unit.update(Unit.engineRoot, delta);
        });
        Unit.engineRoot.on('finalize', () => ticker.clear());
    }

    static scope(snapshot: Snapshot, func: Function, ...args: any[]): any {
        if (snapshot.unit._.status === 'finalized') {
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

    // 祖先列（unit 自身は含まない）。
    static ancestors(unit: Unit | null): Unit[] {
        const ancestors: Unit[] = [];
        for (let u = unit?._.parent ?? null; u !== null; u = u._.parent) ancestors.push(u);
        return ancestors;
    }

    // from を起点に protect 境界越しの対象が current（とその祖先列）から可視か。
    // from から遡って最初の protect 境界を求め、無ければ可視、あれば current かその祖先列に
    // 含まれる（= 境界を通過できる）場合のみ可視。
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
        // 型未指定は全解除。system イベントは listeners に載らないので明示的に加える。
        const types = typeof type === 'string' ? type.trim().split(/\s+/) : [...this._.listeners.keys(), 'update', 'finalize'];

        types.forEach((type) => Unit.off(this, type, listener));
    }
    
    static on(unit: Unit, type: string, listener: Function, options?: boolean | AddEventListenerOptions): void {
        const snapshot = Unit.snapshot(Unit.currentUnit);
        const execute = (props: object = {}) => {
            Unit.scope(snapshot, listener, Object.assign({ type }, props));
        }
        if (type === 'update' || type === 'finalize') {
            // update / finalize は lifecycle 駆動専用。dispatch 経路（listeners / type2units / eventor）
            // には載せず systems だけを登録先にする（emit / sync はこれらを参照しない）。
            unit._.systems[type].push({ listener, execute, count: 0 });
        } else if (unit._.listeners.has(type, listener) === false) {
            unit._.listeners.set(type, listener, { element: unit.element, Component: unit._.currentComponent, execute });
            Unit.type2units.add(type, unit);
            if (/^[A-Za-z]/.test(type) && unit.element !== null) {
                unit._.eventor.add(unit.element, type, execute, options);
            }
        }
    }

    static off(unit: Unit, type: string, listener?: Function): void {
        if (type === 'update' || type === 'finalize') {
            unit._.systems[type] = unit._.systems[type].filter(({ listener: lis }) => listener ? lis !== listener : false);
        } else {
            (listener ? [listener] : [...unit._.listeners.keys(type)]).forEach((listener) => {
                const item = unit._.listeners.get(type, listener);
                if (item !== undefined) {
                    unit._.listeners.delete(type, listener);
                    if (/^[A-Za-z]/.test(type)) {
                        unit._.eventor.remove(type, item.execute);
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
    private promise: Promise<any>;
    public key?: string;
    constructor(promise: Promise<any>, key?: string) { this.promise = promise; this.key = key; }

    // then / catch / finally は捕捉スコープで callback を実行し、戻り値をチェーン値にする。
    // UnitPromise を返した場合は内部 promise に展開して非同期継続を表す。
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

    // promise 群を集約した Promise を返す（解決値は常にオブジェクト）。呼び出し側で
    // new UnitPromise(...) に包む（他の登録分岐と形を揃えるため wrap はここでは行わない）。
    // - キー付きのみ出力に含める（キーが `name[]` 形式なら out[name] を配列にして登録順 push）。
    // - キー無しは await されるが出力には含めない（完了待ちの対象にはなる）。
    public static async collect(promises: UnitPromise[]): Promise<Record<string, any>> {
        const values = await Promise.all(promises.map(p => p.promise));
        const out: Record<string, any> = {};
        promises.forEach((p, i) => {
            if (p.key === undefined) { return; }
            const matched = p.key.match(/^(.+)\[\]$/);
            if (matched !== null) {
                // `name[]` はその name を配列にして登録順に push する。
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

        // タイマーのパラメータはクロージャで捕捉し、props では渡さない。
        const Component = (unit: Unit) => {
            let counter = 0;
            let current = new Timer(onTimeout, onTransition, duration, easing);

            function onTimeout() {
                if (timeout) Unit.scope(snapshot, timeout, { timer });
                // コールバック内で timer.clear() された場合は unit が finalize 済みなので再スケジュールしない。
                if (unit._.status === 'finalized') { return; }
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
        if (this.unit === null || this.unit._.status === 'finalized') {
            this.start(Component);
        } else {
            this.queue.push(Component);
        }
        return this;
    }

    private start(Component: Function) {
        this.unit = Unit.create(Unit.currentUnit, Component);
        this.unit.on('finalize', () => {
            if (this.queue.length > 0) {
                this.start(this.queue.shift()!);
            }
        });
    }
}

