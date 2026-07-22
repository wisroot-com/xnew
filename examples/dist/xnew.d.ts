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
        standalone: boolean;
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

interface XnewBase {
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
    readonly standalone: boolean;
}
declare const xnew: XnewBase & {
    nest(tag: string | DomElementDef, textContent?: string): HTMLElement | SVGElement;
    extend<C extends ComponentFn<any, any>>(Component: C, props?: PropsOf<C>): DefinesOf<C>;
    css: {
        <T extends Record<string, string>>(defs: T): Record<keyof T, string>;
        <T extends Record<string, string>>(layer: string, defs: T): Record<keyof T, string>;
    };
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
    isUnit(value: any): value is Unit;
};
declare namespace xnew {
    type Unit = InstanceType<typeof Unit>;
    type Timer = InstanceType<typeof UnitTimer>;
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
    visibleTo(target: string | string[] | ((clientId: string) => boolean) | null): void;
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
    change(Component: Function, props?: any): void;
    add(Component: Function, props?: any): xnew.Unit;
};

declare function Button(unit: xnew.Unit, { text, className, style, ...others }?: {
    text?: string;
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

declare function GraphicText(unit: xnew.Unit, { text, className, style, ...others }?: {
    text?: string;
    className?: string;
    style?: string;
    [key: string]: any;
}): void;

declare function InputRange(unit: xnew.Unit, { value, min, max, step, vertical, className, style, ...others }?: {
    value?: number;
    min?: number;
    max?: number;
    step?: number;
    vertical?: boolean;
    className?: string;
    style?: string;
    [key: string]: any;
}): void;

declare function InputCheckbox(unit: xnew.Unit, { value, gate, className, style, ...others }?: {
    value?: boolean;
    gate?: {
        open?: boolean;
        duration?: number;
        easing?: string;
    } | xnew.Unit;
    className?: string;
    style?: string;
    [key: string]: any;
}): {
    readonly value: boolean;
    readonly gate: Unit;
};

declare function InputText(unit: xnew.Unit, { value, className, style, ...others }?: {
    value?: string;
    className?: string;
    style?: string;
    [key: string]: any;
}): {
    readonly value: string;
};

declare function InputNumber(unit: xnew.Unit, { value, className, style, ...others }?: {
    value?: number;
    className?: string;
    style?: string;
    [key: string]: any;
}): {
    readonly value: number;
};

declare function InputSwitch(unit: xnew.Unit, { value, gate, className, style, ...others }?: {
    value?: boolean;
    gate?: {
        open?: boolean;
        duration?: number;
        easing?: string;
    } | xnew.Unit;
    className?: string;
    style?: string;
    [key: string]: any;
}): {
    readonly value: boolean;
    readonly gate: Unit;
};

declare function InputRadio(unit: xnew.Unit, { value, name, checked, className, style, ...others }?: {
    value?: string;
    name?: string;
    checked?: boolean;
    className?: string;
    style?: string;
    [key: string]: any;
}): void;

declare function Listbox(unit: xnew.Unit, { value, gate, className, style, ...others }?: {
    value?: string;
    gate?: {
        open?: boolean;
        duration?: number;
        easing?: string;
    } | xnew.Unit;
    className?: string;
    style?: string;
    [key: string]: any;
}): {
    readonly value: string;
    readonly gate: Unit;
    register(item: xnew.Unit): void;
    bind(label: HTMLElement): void;
    select(value: string): void;
};
declare function ListboxButton(unit: xnew.Unit, { className, style, ...others }?: {
    className?: string;
    style?: string;
    [key: string]: any;
}): void;
declare function ListboxMenu(unit: xnew.Unit, { className, style, ...others }?: {
    className?: string;
    style?: string;
    [key: string]: any;
}): void;
declare function ListboxItem(unit: xnew.Unit, { value, className, style, ...others }?: {
    value?: string;
    className?: string;
    style?: string;
    [key: string]: any;
}): {
    readonly value: string;
    check(current: boolean): void;
};

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

declare function Gate(unit: xnew.Unit, { open, duration, easing }: {
    open?: boolean;
    duration?: number;
    easing?: string;
}): {
    readonly value: number;
    readonly state: "opening" | "closing" | "opened" | "closed";
    toggle(): void;
    open(): void;
    close(): void;
};

declare function Accordion(unit: xnew.Unit, { gate, className, style, ...others }?: {
    gate?: {
        open?: boolean;
        duration?: number;
        easing?: string;
    } | xnew.Unit;
    className?: string;
    style?: string;
    [key: string]: any;
}): {
    readonly gate: Unit;
};

declare function ColorPicker(unit: xnew.Unit, { value, presets, alpha, className, style, ...others }?: {
    value?: string;
    presets?: string[];
    alpha?: boolean;
    className?: string;
    style?: string;
    [key: string]: any;
}): {
    value: string;
};

declare function Overlay(unit: xnew.Unit, { gate, anchor, className, style, ...others }?: {
    gate?: {
        open?: boolean;
        duration?: number;
        easing?: string;
    } | xnew.Unit;
    anchor?: HTMLElement;
    className?: string;
    style?: string;
    [key: string]: any;
}): {
    readonly gate: Unit;
};

declare function VirtualPad(unit: xnew.Unit, { type, className, style }?: {
    type?: 'analog' | '4way' | '8way';
    className?: string;
    style?: string;
}): void;

interface PanelOptions {
    name?: string;
    open?: boolean;
    params?: Record<string, any>;
    nested?: boolean;
}
declare function Panel(unit: xnew.Unit, { params, nested }: PanelOptions): {
    folder({ name, open, params }: PanelOptions, inner: Function): Unit;
    button({ name }?: {
        name?: string;
    }): Unit;
    listbox({ name, value, items }?: {
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

type Placement = 'left' | 'right' | 'top' | 'bottom';
declare function VolumeController(unit: xnew.Unit, { placement, className, style }?: {
    placement?: Placement;
    className?: string;
    style?: string;
}): void;

declare const xbasics: {
    Aspect: typeof Aspect;
    Screen: typeof Screen;
    Scene: typeof Scene;
    Button: typeof Button;
    Image: typeof Image;
    GraphicText: typeof GraphicText;
    InputRange: typeof InputRange;
    InputCheckbox: typeof InputCheckbox;
    InputText: typeof InputText;
    InputNumber: typeof InputNumber;
    InputSwitch: typeof InputSwitch;
    InputRadio: typeof InputRadio;
    Listbox: typeof Listbox;
    ListboxButton: typeof ListboxButton;
    ListboxMenu: typeof ListboxMenu;
    ListboxItem: typeof ListboxItem;
    AudioTrack: typeof AudioTrack;
    Synthesizer: typeof Synthesizer;
    Volume: typeof Volume;
    Gate: typeof Gate;
    Accordion: typeof Accordion;
    ColorPicker: typeof ColorPicker;
    Overlay: typeof Overlay;
    VirtualPad: typeof VirtualPad;
    Panel: typeof Panel;
    VolumeController: typeof VolumeController;
};

type IconProps = {
    mode?: 'outline' | 'solid';
    className?: string;
    style?: string;
    [key: string]: any;
};

type IconComponent = (unit: xnew.Unit, props?: IconProps) => void;
declare const xicons: Record<"AcademicCap" | "AdjustmentsHorizontal" | "AdjustmentsVertical" | "ArchiveBoxArrowDown" | "ArchiveBoxXMark" | "ArchiveBox" | "ArrowDownCircle" | "ArrowDownLeft" | "ArrowDownOnSquareStack" | "ArrowDownOnSquare" | "ArrowDownRight" | "ArrowDownTray" | "ArrowDown" | "ArrowLeftCircle" | "ArrowLeftEndOnRectangle" | "ArrowLeftOnRectangle" | "ArrowLeftStartOnRectangle" | "ArrowLeft" | "ArrowLongDown" | "ArrowLongLeft" | "ArrowLongRight" | "ArrowLongUp" | "ArrowPathRoundedSquare" | "ArrowPath" | "ArrowRightCircle" | "ArrowRightEndOnRectangle" | "ArrowRightOnRectangle" | "ArrowRightStartOnRectangle" | "ArrowRight" | "ArrowSmallDown" | "ArrowSmallLeft" | "ArrowSmallRight" | "ArrowSmallUp" | "ArrowTopRightOnSquare" | "ArrowTrendingDown" | "ArrowTrendingUp" | "ArrowTurnDownLeft" | "ArrowTurnDownRight" | "ArrowTurnLeftDown" | "ArrowTurnLeftUp" | "ArrowTurnRightDown" | "ArrowTurnRightUp" | "ArrowTurnUpLeft" | "ArrowTurnUpRight" | "ArrowUpCircle" | "ArrowUpLeft" | "ArrowUpOnSquareStack" | "ArrowUpOnSquare" | "ArrowUpRight" | "ArrowUpTray" | "ArrowUp" | "ArrowUturnDown" | "ArrowUturnLeft" | "ArrowUturnRight" | "ArrowUturnUp" | "ArrowsPointingIn" | "ArrowsPointingOut" | "ArrowsRightLeft" | "ArrowsUpDown" | "AtSymbol" | "Backspace" | "Backward" | "Banknotes" | "Bars2" | "Bars3BottomLeft" | "Bars3BottomRight" | "Bars3CenterLeft" | "Bars3" | "Bars4" | "BarsArrowDown" | "BarsArrowUp" | "Battery0" | "Battery100" | "Battery50" | "Beaker" | "BellAlert" | "BellSlash" | "BellSnooze" | "Bell" | "Bold" | "BoltSlash" | "Bolt" | "BookOpen" | "BookmarkSlash" | "BookmarkSquare" | "Bookmark" | "Briefcase" | "BugAnt" | "BuildingLibrary" | "BuildingOffice2" | "BuildingOffice" | "BuildingStorefront" | "Cake" | "Calculator" | "CalendarDateRange" | "CalendarDays" | "Calendar" | "Camera" | "ChartBarSquare" | "ChartBar" | "ChartPie" | "ChatBubbleBottomCenterText" | "ChatBubbleBottomCenter" | "ChatBubbleLeftEllipsis" | "ChatBubbleLeftRight" | "ChatBubbleLeft" | "ChatBubbleOvalLeftEllipsis" | "ChatBubbleOvalLeft" | "CheckBadge" | "CheckCircle" | "Check" | "ChevronDoubleDown" | "ChevronDoubleLeft" | "ChevronDoubleRight" | "ChevronDoubleUp" | "ChevronDown" | "ChevronLeft" | "ChevronRight" | "ChevronUpDown" | "ChevronUp" | "CircleStack" | "ClipboardDocumentCheck" | "ClipboardDocumentList" | "ClipboardDocument" | "Clipboard" | "Clock" | "CloudArrowDown" | "CloudArrowUp" | "Cloud" | "CodeBracketSquare" | "CodeBracket" | "Cog6Tooth" | "Cog8Tooth" | "Cog" | "CommandLine" | "ComputerDesktop" | "CpuChip" | "CreditCard" | "CubeTransparent" | "Cube" | "CurrencyBangladeshi" | "CurrencyDollar" | "CurrencyEuro" | "CurrencyPound" | "CurrencyRupee" | "CurrencyYen" | "CursorArrowRays" | "CursorArrowRipple" | "DevicePhoneMobile" | "DeviceTablet" | "Divide" | "DocumentArrowDown" | "DocumentArrowUp" | "DocumentChartBar" | "DocumentCheck" | "DocumentCurrencyBangladeshi" | "DocumentCurrencyDollar" | "DocumentCurrencyEuro" | "DocumentCurrencyPound" | "DocumentCurrencyRupee" | "DocumentCurrencyYen" | "DocumentDuplicate" | "DocumentMagnifyingGlass" | "DocumentMinus" | "DocumentPlus" | "DocumentText" | "Document" | "EllipsisHorizontalCircle" | "EllipsisHorizontal" | "EllipsisVertical" | "EnvelopeOpen" | "Envelope" | "Equals" | "ExclamationCircle" | "ExclamationTriangle" | "EyeDropper" | "EyeSlash" | "Eye" | "FaceFrown" | "FaceSmile" | "Film" | "FingerPrint" | "Fire" | "Flag" | "FolderArrowDown" | "FolderMinus" | "FolderOpen" | "FolderPlus" | "Folder" | "Forward" | "Funnel" | "Gif" | "GiftTop" | "Gift" | "GlobeAlt" | "GlobeAmericas" | "GlobeAsiaAustralia" | "GlobeEuropeAfrica" | "H1" | "H2" | "H3" | "HandRaised" | "HandThumbDown" | "HandThumbUp" | "Hashtag" | "Heart" | "HomeModern" | "Home" | "Identification" | "InboxArrowDown" | "InboxStack" | "Inbox" | "InformationCircle" | "Italic" | "Key" | "Language" | "Lifebuoy" | "LightBulb" | "LinkSlash" | "Link" | "ListBullet" | "LockClosed" | "LockOpen" | "MagnifyingGlassCircle" | "MagnifyingGlassMinus" | "MagnifyingGlassPlus" | "MagnifyingGlass" | "MapPin" | "Map" | "Megaphone" | "Microphone" | "MinusCircle" | "MinusSmall" | "Minus" | "Moon" | "MusicalNote" | "Newspaper" | "NoSymbol" | "NumberedList" | "PaintBrush" | "PaperAirplane" | "PaperClip" | "PauseCircle" | "Pause" | "PencilSquare" | "Pencil" | "PercentBadge" | "PhoneArrowDownLeft" | "PhoneArrowUpRight" | "PhoneXMark" | "Phone" | "Photo" | "PlayCircle" | "PlayPause" | "Play" | "PlusCircle" | "PlusSmall" | "Plus" | "Power" | "PresentationChartBar" | "PresentationChartLine" | "Printer" | "PuzzlePiece" | "QrCode" | "QuestionMarkCircle" | "QueueList" | "Radio" | "ReceiptPercent" | "ReceiptRefund" | "RectangleGroup" | "RectangleStack" | "RocketLaunch" | "Rss" | "Scale" | "Scissors" | "ServerStack" | "Server" | "Share" | "ShieldCheck" | "ShieldExclamation" | "ShoppingBag" | "ShoppingCart" | "SignalSlash" | "Signal" | "Slash" | "Sparkles" | "SpeakerWave" | "SpeakerXMark" | "Square2Stack" | "Square3Stack3d" | "Squares2x2" | "SquaresPlus" | "Star" | "StopCircle" | "Stop" | "Strikethrough" | "Sun" | "Swatch" | "TableCells" | "Tag" | "Ticket" | "Trash" | "Trophy" | "Truck" | "Tv" | "Underline" | "UserCircle" | "UserGroup" | "UserMinus" | "UserPlus" | "User" | "Users" | "Variable" | "VideoCameraSlash" | "VideoCamera" | "ViewColumns" | "ViewfinderCircle" | "Wallet" | "Wifi" | "Window" | "WrenchScrewdriver" | "Wrench" | "XCircle" | "XMark", IconComponent>;

interface TextureUniform {
    value: number | number[];
    min?: number;
    max?: number;
    step?: number;
}
interface TextureDef {
    name: string;
    fn: string;
    glsl: string;
    uniforms: Record<string, TextureUniform>;
}

type TextureComponent = ((unit: xnew.Unit, props?: any) => any) & {
    def: TextureDef;
    glsl: string;
    fn: string;
    uniforms: TextureDef['uniforms'];
};
declare const xtextures: {
    Wood: TextureComponent;
};

export { xbasics, xicons, xnew, xsync, xtextures };
