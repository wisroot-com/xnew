declare class MapSet<Key, Value> extends Map<Key, Set<Value>> {
    has(key: Key): boolean;
    has(key: Key, value: Value): boolean;
    add(key: Key, value: Value): MapSet<Key, Value>;
    keys(): IterableIterator<Key>;
    keys(key: Key): IterableIterator<Value>;
    delete(key: Key): boolean;
    delete(key: Key, value: Value): boolean;
}
declare class MapMap<Key1, Key2, Value> extends Map<Key1, Map<Key2, Value>> {
    has(key1: Key1): boolean;
    has(key1: Key1, key2: Key2): boolean;
    set(key1: Key1, value: Map<Key2, Value>): this;
    set(key1: Key1, key2: Key2, value: Value): this;
    get(key1: Key1): Map<Key2, Value> | undefined;
    get(key1: Key1, key2: Key2): Value | undefined;
    keys(): IterableIterator<Key1>;
    keys(key1: Key1): IterableIterator<Key2>;
    delete(key1: Key1): boolean;
    delete(key1: Key1, key2: Key2): boolean;
}

type DomElement = HTMLElement | SVGElement;
declare class EventBinder {
    private map;
    add(element: DomElement, type: string, listener: Function, options?: boolean | AddEventListenerOptions): void;
    remove(type: string, listener: Function): void;
}

interface Context {
    previous: Context | null;
    key?: any;
    value?: any;
}
interface Snapshot {
    unit: Unit;
    context: Context;
    element: DomElement;
    Component: Function | null;
}
type ComponentFn<P extends object = any, A extends object = {}> = (unit: Unit, props: P) => A | void;
type DefinesOf<C> = C extends (...args: any[]) => infer R ? ([R] extends [void] ? {} : Exclude<R, void | undefined>) : {};
type PropsOf<C> = C extends (unit: Unit, props: infer P, ...rest: any[]) => any ? P : {};
declare class Unit {
    [key: string]: any;
    _: {
        parent: Unit | null;
        children: Unit[];
        phase: 'invoked' | 'initialized' | 'finalizing' | 'finalized';
        protected: boolean;
        promises: UnitPromise[];
        defines: Record<string, any>;
        systems: Record<'update' | 'finalize', {
            listener: Function;
            execute: Function;
            count: number;
            owner: Unit;
        }[]>;
        currentElement: DomElement;
        currentContext: Context;
        currentComponent: Function | null;
        lastSnapshot: Snapshot | null;
        nestElements: {
            element: DomElement;
            owned: boolean;
        }[];
        Components: Function[];
        listeners: MapMap<string, Function, {
            execute: Function;
            owner: Unit;
        }>;
        events: EventBinder;
        key: any;
    };
    constructor(parent?: Unit | null);
    static create(parent: Unit | null, ...args: any[]): Unit;
    static initialize(unit: Unit, ...args: any[]): void;
    get parent(): Unit | null;
    get element(): DomElement;
    finalize(): void;
    static nest(unit: Unit, target: DomElement | string, textContent?: string | number): DomElement;
    static extend(unit: Unit, Component: Function, props?: Object): {
        [key: string]: any;
    };
    static update(unit: Unit, delta?: number): void;
    static engineRoot: Unit;
    static currentUnit: Unit;
    static get current(): Unit;
    static reset(): void;
    static scope(snapshot: Snapshot, func: Function, ...args: any[]): any;
    static snapshot(unit: Unit): Snapshot;
    static unit2Contexts: MapSet<Unit, Context>;
    static addContext(unit: Unit, orner: Unit, key: any, value?: any): void;
    static getContext(unit: Unit, key: any): any;
    static component2units: MapSet<Function, Unit>;
    static ancestors(unit: Unit | null): Unit[];
    static isVisible(from: Unit | null, current: Unit | null, ancestors: Unit[]): boolean;
    static find(Component: Function, key?: any): Unit[];
    static type2units: MapSet<string, Unit>;
    on(type: string, listener: Function, options?: boolean | AddEventListenerOptions): void;
    off(type?: string, listener?: Function): void;
    static owner2targets: MapSet<Unit, Unit>;
    static on(unit: Unit, type: string, listener: Function, options?: boolean | AddEventListenerOptions): void;
    static off(unit: Unit, owner: Unit | null, type: string, listener?: Function): void;
    static emit(unit: Unit, type: string, props?: object): void;
}
declare class UnitPromise {
    private promise;
    key?: string | undefined;
    constructor(promise: Promise<any>, key?: string | undefined);
    private chain;
    then(callback: Function): UnitPromise;
    catch(callback: Function): UnitPromise;
    finally(callback: Function): UnitPromise;
    static collect(promises: UnitPromise[]): Promise<Record<string, any>>;
}
declare class UnitTimer {
    private unit;
    private queue;
    clear(): void;
    timeout(timeout: Function, duration?: number): this;
    interval(timeout: Function, duration?: number, iterations?: number): this;
    transition(transition: Function, duration?: number, easing?: string): this;
    private execute;
    private start;
}

interface XnewBase {
    <C extends ComponentFn<any, any>>(Component: C, props?: PropsOf<C>): Unit & DefinesOf<C>;
    <C extends ComponentFn<any, any>>(target: DomElement | string, Component: C, props?: PropsOf<C>): Unit & DefinesOf<C>;
    (target: DomElement | string, content?: string | number): Unit;
    (content: string | number): Unit;
    (parent: Unit | null, ...args: any[]): Unit;
    (): Unit;
}
declare const xnew: XnewBase & {
    nest(target: DomElement | string): HTMLElement | SVGElement;
    extend<C extends ComponentFn<any, any>>(Component: C, props?: PropsOf<C>): DefinesOf<C>;
    context(key: any): any;
    promise: {
        (promise: Function | Promise<any> | Unit): UnitPromise;
        (key: string, promise: Function | Promise<any> | Unit): UnitPromise;
    };
    scope(callback: any): any;
    find(Component: Function, opts?: {
        key?: any;
    }): Unit[];
    emit(type: string, ...args: any[]): void;
    timeout(callback: Function, duration?: number): UnitTimer;
    interval(callback: Function, duration: number, iterations?: number): UnitTimer;
    transition(transition: Function, duration?: number, easing?: string): UnitTimer;
    protect(): void;
};
declare namespace xnew {
    type Unit = InstanceType<typeof Unit>;
    type Component<P extends object = any, A extends object = {}> = ComponentFn<P, A>;
}

interface ClientStatus {
    id: string;
    name: string;
}
interface RoomStatus {
    id: string;
    name: string;
    count: number;
}
interface BootServerOptions {
    io: any;
    room: RoomStatus;
}
interface BootClientOptions {
    io: any;
    room: RoomStatus;
    client: any;
}
declare const xsync: {
    server<C extends ComponentFn<any, any>>(callback: C, props?: PropsOf<C>): DefinesOf<C> | {};
    client<C extends ComponentFn<any, any>>(callback: C, props?: PropsOf<C>): DefinesOf<C> | {};
    state(initial?: Record<string, any>): Record<string, any>;
    register(Components: Record<string, Function>): void;
    readonly session: {
        room: RoomStatus;
        clients: ClientStatus[];
        myself: ClientStatus;
    };
    emitToServer(type: string, props?: Record<string, any>): void;
    emitToClients(type: string, props?: Record<string, any>, ids?: string[]): void;
    boot(opts: BootServerOptions | BootClientOptions, ...args: any[]): Unit;
};

declare function OpenAndClose(unit: Unit, { open, duration, easing }: {
    open?: boolean;
    duration?: number;
    easing?: string;
}): {
    toggle(): void;
    open(): void;
    close(): void;
};
declare function Accordion(unit: Unit): void;
declare function Popup(unit: Unit): void;

interface SVGInterface {
    viewBox?: string;
    className?: string;
    style?: string;
    stroke?: string;
    strokeOpacity?: number;
    strokeWidth?: number;
    strokeLinejoin?: string;
    strokeLinecap?: string;
    fill?: string;
    fillOpacity?: number;
}
declare function SVG(unit: Unit, { viewBox, className, style, stroke, strokeOpacity, strokeWidth, strokeLinejoin, strokeLinecap, fill, fillOpacity }?: SVGInterface): void;
interface SVGTextInterface {
    text?: string;
    fontSize?: number;
    anchor?: {
        x: number;
        y: number;
    };
    className?: string;
    style?: string;
    stroke?: string;
    strokeOpacity?: number;
    strokeWidth?: number;
    strokeLinejoin?: string;
    strokeLinecap?: string;
    fill?: string;
    fillOpacity?: number;
}
declare function SVGText(unit: Unit, { text, fontSize, anchor, className, style, stroke, strokeOpacity, strokeWidth, strokeLinejoin, strokeLinecap, fill, fillOpacity }?: SVGTextInterface): void;

declare function AnalogStick(unit: Unit, { stroke, strokeOpacity, strokeWidth, fill, fillOpacity }?: {
    stroke?: string;
    strokeOpacity?: number;
    strokeWidth?: number;
    fill?: string;
    fillOpacity?: number;
}): void;
declare function DPad(unit: Unit, { diagonal, stroke, strokeOpacity, strokeWidth, fill, fillOpacity }?: {
    diagonal?: boolean;
    stroke?: string;
    strokeOpacity?: number;
    strokeWidth?: number;
    fill?: string;
    fillOpacity?: number;
}): void;

interface PanelOptions {
    name?: string;
    open?: boolean;
    params?: Record<string, any>;
}
declare function Panel(unit: Unit, { params }: PanelOptions): {
    group({ name, open, params }: PanelOptions, inner: Function): Unit;
    button(key: string): Unit;
    select(key: string, { value, items }?: {
        value?: string;
        items?: string[];
    }): Unit;
    range(key: string, { value, min, max, step }?: {
        value?: number;
        min?: number;
        max?: number;
        step?: number;
    }): Unit;
    checkbox(key: string, { value }?: {
        value?: boolean;
    }): Unit;
    separator(): void;
};

declare function Aspect(unit: Unit, { aspect, fit }?: {
    aspect?: number;
    fit?: 'contain' | 'cover';
}): void;
declare function Screen(unit: Unit, { width, height, fit }?: {
    width?: number;
    height?: number;
    fit?: 'contain' | 'cover';
}): {
    readonly canvas: DomElement;
};
declare function Scene(unit: Unit): {
    change(Component: Function, props?: any): void;
    add(Component: Function, props?: any): void;
};

type ImageSource = string | Blob | ArrayBuffer | ArrayBufferView<ArrayBuffer>;
declare function Image(unit: Unit, { src, className, style }: {
    src: ImageSource | Promise<ImageSource>;
    className?: string;
    style?: string;
}): void;

declare function AudioTrack(unit: Unit, { url, volume, loop }: {
    url: string;
    volume?: number;
    loop?: boolean;
}): {
    play: ({ offset, fade: fadeMs, loop: loopArg }?: {
        offset?: number;
        fade?: number;
        loop?: boolean;
    }) => void;
    pause({ fade: fadeMs }?: {
        fade?: number;
    }): void;
    readonly isPlaying: boolean;
    readonly isLoaded: boolean;
    volume: number;
};
type SynthesizerOptions = {
    oscillator: OscillatorOptions;
    amp: AmpOptions;
    filter?: FilterOptions;
    reverb?: ReverbOptions;
    bpm?: number;
};
type OscillatorOptions = {
    type: OscillatorType;
    envelope?: Envelope;
    LFO?: LFO;
};
type FilterOptions = {
    type: BiquadFilterType;
    cutoff: number;
};
type AmpOptions = {
    envelope: Envelope;
};
type ReverbOptions = {
    time: number;
    mix: number;
};
type Envelope = {
    amount: number;
    ADSR: [number, number, number, number];
};
type LFO = {
    amount: number;
    type: OscillatorType;
    rate: number;
};
declare function Synthesizer(unit: Unit, props: SynthesizerOptions): {
    press: (frequency: number | string, duration?: number | string, wait?: number) => {
        release: () => void;
    } | undefined;
};
declare function Volume(unit: Unit): {
    volume: number;
};

declare const xbasics: {
    SVG: typeof SVG;
    SVGText: typeof SVGText;
    Aspect: typeof Aspect;
    Screen: typeof Screen;
    Image: typeof Image;
    OpenAndClose: typeof OpenAndClose;
    AnalogStick: typeof AnalogStick;
    DPad: typeof DPad;
    Panel: typeof Panel;
    Accordion: typeof Accordion;
    Popup: typeof Popup;
    Scene: typeof Scene;
    AudioTrack: typeof AudioTrack;
    Synthesizer: typeof Synthesizer;
    Volume: typeof Volume;
};

export { xbasics, xnew, xsync };
