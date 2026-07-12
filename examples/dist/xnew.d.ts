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
interface DomElementDef {
    tag: string;
    className?: string;
    style?: string;
    [key: string]: any;
}
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
        nestElements: DomElement[];
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
    static nest(unit: Unit, tag: string | DomElementDef, textContent?: string): DomElement;
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
    once(type: string, listener: Function, options?: boolean | AddEventListenerOptions): void;
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

interface CssDef {
    layer?: string;
    type?: string;
    body: string;
}

interface XnewBase {
    <C extends ComponentFn<any, any>>(Component: C, props?: PropsOf<C>): Unit & DefinesOf<C>;
    <C extends ComponentFn<any, any>>(target: DomElement | string | DomElementDef, Component: C, props?: PropsOf<C>): Unit & DefinesOf<C>;
    (target: DomElement | string | DomElementDef, content?: string | number): Unit;
    (content: string | number): Unit;
    (parent: Unit | null, ...args: any[]): Unit;
    (): Unit;
}
declare const xnew: XnewBase & {
    nest(tag: string | DomElementDef, textContent?: string): HTMLElement | SVGElement;
    extend<C extends ComponentFn<any, any>>(Component: C, props?: PropsOf<C>): DefinesOf<C>;
    css<T extends Record<string, string | CssDef>>(defs: T): Record<keyof T, string>;
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
    type ElementDef = DomElementDef;
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

declare function Aspect(unit: xnew.Unit, { aspect, fit }?: {
    aspect?: number;
    fit?: 'contain' | 'cover';
}): void;

declare function Screen(unit: xnew.Unit, { width, height, fit }?: {
    width?: number;
    height?: number;
    fit?: 'contain' | 'cover';
}): {
    readonly canvas: DomElement;
};

declare function Scene(unit: xnew.Unit): {
    change(target: string | Function, props?: any): void;
    add(Component: Function, props?: any): xnew.Unit;
};

type SceneEntry = [Function, any?];
declare function SceneList(unit: xnew.Unit, { list }?: {
    list?: {
        [label: string]: SceneEntry;
    };
}): {
    resolve(label: string): SceneEntry | undefined;
};

declare function Button(unit: xnew.Unit, { text, className, style, ...others }?: {
    text?: string;
    className?: string;
    style?: string;
    [key: string]: any;
}): void;

declare function Chevron(unit: xnew.Unit, { direction, className, style, ...others }?: {
    direction?: 'up' | 'down' | 'left' | 'right';
    className?: string;
    style?: string;
    [key: string]: any;
}): void;

type ImageSource = string | Blob | ArrayBuffer | ArrayBufferView<ArrayBuffer>;
declare function Image(unit: xnew.Unit, { src, className, style, ...others }: {
    src: ImageSource | Promise<ImageSource>;
    className?: string;
    style?: string;
    [key: string]: any;
}): void;

declare function SVG(unit: xnew.Unit, { className, style, ...others }?: {
    className?: string;
    style?: string;
    [key: string]: any;
}): void;

declare function SVGText(unit: xnew.Unit, { text, fontSize, className, style, ...others }?: {
    text?: string;
    fontSize?: number;
    className?: string;
    style?: string;
    [key: string]: any;
}): void;

interface Design {
    className?: string;
    style?: string;
}

declare function InputRange(unit: xnew.Unit, { value, min, max, step, className, style, designs, ...others }?: {
    value?: number;
    min?: number;
    max?: number;
    step?: number;
    className?: string;
    style?: string;
    designs?: {
        frame?: Design;
        meter?: Design;
        status?: Design;
    };
    [key: string]: any;
}): void;

declare function InputCheckbox(unit: xnew.Unit, { value, className, style, designs, ...others }?: {
    value?: boolean;
    className?: string;
    style?: string;
    designs?: {
        frame?: Design;
    };
    [key: string]: any;
}): void;

declare function InputText(unit: xnew.Unit, { className, style, ...others }?: {
    className?: string;
    style?: string;
    [key: string]: any;
}): void;

declare function InputNumber(unit: xnew.Unit, { className, style, ...others }?: {
    className?: string;
    style?: string;
    [key: string]: any;
}): void;

declare function InputSwitch(unit: xnew.Unit, { value, className, style, designs, ...others }?: {
    value?: boolean;
    className?: string;
    style?: string;
    designs?: {
        frame?: Design;
        knob?: Design;
    };
    [key: string]: any;
}): void;

declare function InputRadio(unit: xnew.Unit, { value, items, name, className, style, designs }?: {
    value?: string;
    items?: string[];
    name?: string;
    className?: string;
    style?: string;
    designs?: {
        frame?: Design;
        item?: Design;
    };
}): void;

declare function InputSelect(unit: xnew.Unit, { value, items, className, style, designs, ...others }?: {
    value?: string;
    items?: string[];
    className?: string;
    style?: string;
    designs?: {
        frame?: Design;
        label?: Design;
        menu?: Design;
        item?: Design;
    };
    [key: string]: any;
}): void;

declare function AudioTrack(unit: xnew.Unit, { url, volume, loop }: {
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
    readonly status: "loading" | "loaded" | "playing" | "paused";
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
declare function Synthesizer(unit: xnew.Unit, props: SynthesizerOptions): {
    press: (frequency: number | string, duration?: number | string, wait?: number) => {
        release: () => void;
    } | undefined;
};

declare function Volume(unit: xnew.Unit): {
    volume: number;
};

declare function OpenAndClose(unit: xnew.Unit, { open, duration, easing }: {
    open?: boolean;
    duration?: number;
    easing?: string;
}): {
    toggle(): void;
    open(): void;
    close(): void;
};

declare function Accordion(unit: xnew.Unit): void;

declare function Popup(unit: xnew.Unit): void;

declare function AnalogStick(unit: xnew.Unit, { className, style, designs }?: {
    className?: string;
    style?: string;
    designs?: {
        svg?: Design;
    };
}): void;

declare function DPad(unit: xnew.Unit, { diagonal, className, style, designs }?: {
    diagonal?: boolean;
    className?: string;
    style?: string;
    designs?: {
        svg?: Design;
    };
}): void;

interface PanelOptions {
    name?: string;
    open?: boolean;
    params?: Record<string, any>;
    nested?: boolean;
}
declare function Panel(unit: xnew.Unit, { params, nested }: PanelOptions): {
    group({ name, open, params }: PanelOptions, inner: Function): Unit;
    button({ name }?: {
        name?: string;
    }): Unit;
    select({ name, value, items }?: {
        name?: string;
        value?: string;
        items?: string[];
    }): Unit;
    range({ name, value, min, max, step }?: {
        name?: string;
        value?: number;
        min?: number;
        max?: number;
        step?: number;
    }): Unit;
    checkbox({ name, value }?: {
        name?: string;
        value?: boolean;
    }): Unit;
    separator(): void;
};

declare const xbasics: {
    Aspect: typeof Aspect;
    Screen: typeof Screen;
    Scene: typeof Scene;
    SceneList: typeof SceneList;
    Button: typeof Button;
    Chevron: typeof Chevron;
    Image: typeof Image;
    SVG: typeof SVG;
    SVGText: typeof SVGText;
    InputRange: typeof InputRange;
    InputCheckbox: typeof InputCheckbox;
    InputText: typeof InputText;
    InputNumber: typeof InputNumber;
    InputSwitch: typeof InputSwitch;
    InputRadio: typeof InputRadio;
    InputSelect: typeof InputSelect;
    AudioTrack: typeof AudioTrack;
    Synthesizer: typeof Synthesizer;
    Volume: typeof Volume;
    OpenAndClose: typeof OpenAndClose;
    Accordion: typeof Accordion;
    Popup: typeof Popup;
    AnalogStick: typeof AnalogStick;
    DPad: typeof DPad;
    Panel: typeof Panel;
};

export { xbasics, xnew, xsync };
