declare class MapSet<Key, Value> extends Map<Key, Set<Value>> {
    has(key: Key): boolean;
    has(key: Key, value: Value): boolean;
    add(key: Key, value: Value): MapSet<Key, Value>;
    keys(): IterableIterator<Key>;
    keys(key: Key): IterableIterator<Value>;
    delete(key: Key): boolean;
    delete(key: Key, value: Value): boolean;
}

type DOMElement = HTMLElement | SVGElement;
interface DOMElementDef {
    tag: string;
    className?: string;
    style?: string;
    [key: string]: any;
}
declare class EventBinder {
    private map;
    add(element: DOMElement, type: string, listener: Function, options?: boolean | AddEventListenerOptions): void;
    remove(type: string, listener: Function): void;
}

interface Context {
    previous: Context | null;
    Component?: Function;
    value?: any;
}
interface Snapshot {
    unit: Unit;
    context: Context;
    element: DOMElement;
    Component: Function | null;
}
interface ListenerEntry {
    listener: Function;
    execute: Function;
    owner: Unit;
}
type SystemType = 'update' | 'destroy' | 'childattach' | 'childdetach';
interface SyncData {
    root: Unit | null;
    id: number | null;
    state: Record<string, any>;
    registry: Record<string, Function>;
    visibility: ((clientId: string) => boolean) | null;
}
type ComponentFn<P extends object = any, A extends object = {}> = (unit: Unit, props: P) => A | void;
type PropsOf<C> = C extends (unit: Unit, props: infer P, ...rest: any[]) => any ? P : {};
type PropsArg<C> = {} extends PropsOf<C> ? [props?: PropsOf<C>] : [props: PropsOf<C>];
declare class Unit {
    [key: string]: any;
    _: {
        parent: Unit | null;
        children: Unit[];
        phase: 'invoked' | 'active' | 'destroying' | 'destroyed';
        attached: boolean;
        protected: boolean;
        standalone: boolean;
        standalonePending: Function[] | null;
        promises: UnitPromise[];
        defines: Record<string, any>;
        systems: Record<SystemType, {
            listener: Function;
            execute: Function;
            count: number;
            owner: Unit;
        }[]>;
        currentElement: DOMElement;
        currentContext: Context;
        currentComponent: Function | null;
        lastSnapshot: Snapshot | null;
        nestElements: DOMElement[];
        Components: Function[];
        listeners: MapSet<string, ListenerEntry>;
        events: EventBinder;
        key: any;
        sync: SyncData;
    };
    constructor(parent: Unit | null, ...args: any[]);
    get parent(): Unit | null;
    get current(): DOMElement;
    get container(): DOMElement | null;
    destroy(): void;
    static nest(unit: Unit, tag: string | DOMElementDef, textContent?: string): DOMElement;
    static extend(unit: Unit, Component: Function, props?: Object): {
        [key: string]: any;
    };
    static update(unit: Unit, delta?: number): void;
    static engineRoot: Unit;
    static currentUnit: Unit;
    static reset(): void;
    static scope(snapshot: Snapshot, func: Function, ...args: any[]): any;
    static snapshot(unit: Unit): Snapshot;
    static unit2Contexts: MapSet<Unit, Context>;
    static addContext(unit: Unit, orner: Unit, Component: Function, value?: any): void;
    static getContext(unit: Unit, Component: Function): any;
    static component2units: MapSet<Function, Unit>;
    static ancestors(unit: Unit | null): Unit[];
    static isVisible(from: Unit | null, current: Unit | null, ancestors: Unit[]): boolean;
    static find(Component: Function, options?: {
        key?: any;
        ancestor?: Unit;
        parent?: Unit;
    }): Unit[];
    static type2units: MapSet<string, Unit>;
    on(type: string, listener: Function, options?: boolean | AddEventListenerOptions): void;
    once(type: string, listener: Function, options?: boolean | AddEventListenerOptions): void;
    off(type?: string, listener?: Function): void;
    static owner2targets: MapSet<Unit, Unit>;
    static target2owners: MapSet<Unit, Unit>;
    static on(unit: Unit, type: string, listener: Function, options?: boolean | AddEventListenerOptions): void;
    static registered(unit: Unit, type: string, listener: Function, owner: Unit): boolean;
    static off(unit: Unit, owner: Unit | null, type: string, listener?: Function): void;
    static dispatch(type: string, props: object, accept: (unit: Unit, entry: ListenerEntry) => boolean): void;
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

type CSSDef = string | {
    rule: '@keyframes' | '@property' | '@counter-style';
    body: string;
} | {
    rule: '@font-face';
    body: string | string[];
};

interface XnewBase {
    <C extends ComponentFn<any, any>>(Component: C, ...args: PropsArg<C>): Unit;
    <C extends ComponentFn<any, any>>(target: DOMElement | string | DOMElementDef, Component: C, ...args: PropsArg<C>): Unit;
    (target: DOMElement | string | DOMElementDef, content?: string | number): Unit;
    (parent: Unit | null, ...args: any[]): Unit;
    (): Unit;
    standalone(callback: () => void): void;
}
declare const xnew: XnewBase & {
    nest(tag: string | DOMElementDef, textContent?: string): HTMLElement | SVGElement;
    extend<C extends ComponentFn<any, any>>(Component: C, ...args: PropsArg<C>): Record<string, any>;
    standalone(callback: () => void): void;
    css: {
        <T extends Record<string, CSSDef>>(defs: T): Record<keyof T, string>;
        <T extends Record<string, CSSDef>>(layer: string, defs: T): Record<keyof T, string>;
    };
    context(Component: Function): any;
    promise: {
        (promise: Function | Promise<any> | Unit): UnitPromise;
        (key: string, promise: Function | Promise<any> | Unit): UnitPromise;
    };
    scope(callback: any): any;
    find(Component: Function, options?: {
        key?: any;
        ancestor?: Unit;
        parent?: Unit;
    }): Unit[];
    emit(type: string, props?: object): void;
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
    cpu?: boolean;
}
interface RoomStatus {
    id: string;
    name: string;
    count: number;
}
interface BootOptions {
    io: any;
    room: RoomStatus;
    client?: any;
}

declare const xsync: {
    server<C extends ComponentFn<any, any>>(callback: C, ...args: PropsArg<C>): Record<string, any>;
    client<C extends ComponentFn<any, any>>(callback: C, ...args: PropsArg<C>): Record<string, any>;
    state(initial?: Record<string, any>): Record<string, any>;
    register(Components: Record<string, Function>): void;
    visibility(target: ((clientId: string) => boolean) | null): void;
    readonly session: {
        room: RoomStatus;
        clients: ClientStatus[];
        myself: ClientStatus;
    };
    emit(type: string, props?: Record<string, any>, clients?: ClientStatus | ClientStatus[]): void;
    cpu: {
        join(client: {
            id: string;
            name?: string;
        }): ClientStatus;
        leave(id: string): boolean;
        dispatch(type: string, id: string, props?: Record<string, any>): void;
    };
    boot<C extends ComponentFn<any, any>>(options: BootOptions, Component: C, ...args: PropsArg<C>): Unit;
};

declare class AudioTrack {
    readonly promise: Promise<void>;
    private buffer;
    private source;
    private startedAt;
    private paused;
    private pausedOffsetMs;
    private looping;
    private readonly amp;
    private readonly fade;
    constructor({ url, volume, loop }: {
        url: string;
        volume?: number;
        loop?: boolean;
    });
    play({ offset, fade: fadeMs, loop: loopArg }?: {
        offset?: number;
        fade?: number;
        loop?: boolean;
    }): void;
    pause({ fade: fadeMs }?: {
        fade?: number;
    }): void;
    get status(): 'loading' | 'loaded' | 'playing' | 'paused';
    get volume(): number;
    set volume(value: number);
    clear(): void;
    private forceStop;
    private startSource;
    private stopSource;
}

type SynthesizerOptions = {
    oscillator: {
        type: OscillatorType;
        envelope?: Envelope;
        LFO?: {
            amount: number;
            type: OscillatorType;
            rate: number;
        };
    };
    amp: {
        envelope: Envelope;
    };
    filter?: {
        type: BiquadFilterType;
        cutoff: number;
    };
    reverb?: {
        time: number;
        mix: number;
    };
    bpm?: number;
};
type Envelope = {
    amount: number;
    ADSR: [number, number, number, number];
};
declare class Synthesizer {
    private readonly props;
    private readonly active;
    constructor(props: SynthesizerOptions);
    press(frequency: number | string, duration?: number | string, wait?: number): {
        release: () => void;
    } | undefined;
    clear(): void;
}

declare const xaudio: {
    load(props: {
        url: string;
        volume?: number;
        loop?: boolean;
    }): AudioTrack;
    synthesizer(props: SynthesizerOptions): Synthesizer;
    volume: number;
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
    readonly canvas: DOMElement;
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

declare function SVGText(unit: xnew.Unit, { text, className, style, ...others }?: {
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
}): {
    value: number;
    readonly input: HTMLInputElement;
};

declare function InputCheckbox(unit: xnew.Unit, { value, className, style, ...others }?: {
    value?: boolean;
    className?: string;
    style?: string;
    [key: string]: any;
}): {
    value: boolean;
    readonly input: HTMLInputElement;
};

declare function InputText(unit: xnew.Unit, { value, className, style, ...others }?: {
    value?: string;
    className?: string;
    style?: string;
    [key: string]: any;
}): {
    value: string;
    readonly input: HTMLInputElement;
};

declare function InputNumber(unit: xnew.Unit, { value, className, style, ...others }?: {
    value?: number;
    className?: string;
    style?: string;
    [key: string]: any;
}): {
    value: number;
    readonly input: HTMLInputElement;
};

declare function InputSwitch(unit: xnew.Unit, { value, className, style, ...others }?: {
    value?: boolean;
    className?: string;
    style?: string;
    [key: string]: any;
}): {
    value: boolean;
    readonly input: HTMLInputElement;
};

type ItemDef<T = string> = T | {
    value: T;
    label?: string;
};
declare function Listbox(unit: xnew.Unit, { value, items, duration, easing, className, style, ...others }?: {
    value?: string;
    items?: ItemDef[];
    duration?: number;
    easing?: string;
    className?: string;
    style?: string;
    [key: string]: any;
}): {
    value: string;
    readonly gate: Unit;
    register(row: xnew.Unit): void;
    bind(label: xnew.Unit): void;
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
declare function ListboxItem(unit: xnew.Unit, { value, label, className, style, ...others }?: {
    value?: string;
    label?: string;
    className?: string;
    style?: string;
    [key: string]: any;
}): {
    readonly value: string;
    readonly label: string | undefined;
    check(current: boolean): void;
};

declare function InputRadioGroup(unit: xnew.Unit, { value, items, name, className, style, ...others }?: {
    value?: string;
    items?: ItemDef[];
    name?: string;
    className?: string;
    style?: string;
    [key: string]: any;
}): {
    readonly name: string;
    value: string;
    register(row: xnew.Unit): void;
};
declare function InputRadio(unit: xnew.Unit, { value, label, name, checked, className, style, ...others }?: {
    value?: string;
    label?: string;
    name?: string;
    checked?: boolean;
    className?: string;
    style?: string;
    [key: string]: any;
}): {
    readonly value: string;
    readonly label: string | undefined;
    checked: boolean;
    check(current: boolean): void;
    readonly input: HTMLInputElement;
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

type GateProps = {
    open?: boolean;
    duration?: number;
    easing?: string;
};
declare function Gate(unit: xnew.Unit, { open, duration, easing }?: GateProps): {
    readonly value: number;
    readonly state: "opening" | "closing" | "opened" | "closed";
    toggle(): void;
    open(): void;
    close(): void;
};

declare function Accordion(unit: xnew.Unit, { gate, className, style, ...others }?: {
    gate?: GateProps | xnew.Unit;
    className?: string;
    style?: string;
    [key: string]: any;
}): {
    readonly gate: Unit;
};

declare function Overlay(unit: xnew.Unit, { gate, anchor, className, style, ...others }?: {
    gate?: GateProps | xnew.Unit;
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
    key?: any;
}
declare function Panel(unit: xnew.Unit, { name, open, className, style }?: PanelOptions & {
    className?: string;
    style?: string;
}): void;
declare function PanelGroup(unit: xnew.Unit, { name, open }: PanelOptions): {
    tabs({ items, value }?: {
        items?: ItemDef<any>[];
        value?: any;
    }): Unit;
    group({ name, open, key }: PanelOptions, inner?: (group: xnew.Unit) => void): Unit;
    button({ name, key }?: {
        name?: string;
        key?: any;
    }): Unit;
    listbox({ name, value, items, key }?: {
        name?: string;
        value?: string;
        items?: ItemDef[];
        key?: any;
    }): Unit;
    range({ name, value, min, max, step, key }?: {
        name?: string;
        value?: number;
        min?: number;
        max?: number;
        step?: number;
        key?: any;
    }): Unit;
    checkbox({ name, value, key }?: {
        name?: string;
        value?: boolean;
        key?: any;
    }): Unit;
    color({ name, value, key }?: {
        name?: string;
        value?: string;
        key?: any;
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
    SVGText: typeof SVGText;
    InputRange: typeof InputRange;
    InputCheckbox: typeof InputCheckbox;
    InputText: typeof InputText;
    InputNumber: typeof InputNumber;
    InputSwitch: typeof InputSwitch;
    InputRadio: typeof InputRadio;
    InputRadioGroup: typeof InputRadioGroup;
    Listbox: typeof Listbox;
    ListboxButton: typeof ListboxButton;
    ListboxMenu: typeof ListboxMenu;
    ListboxItem: typeof ListboxItem;
    ColorPicker: typeof ColorPicker;
    Gate: typeof Gate;
    Accordion: typeof Accordion;
    Overlay: typeof Overlay;
    VirtualPad: typeof VirtualPad;
    Panel: typeof Panel;
    PanelGroup: typeof PanelGroup;
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

interface TextureRange {
    min: number;
    max: number;
}
type TexturePreset = Record<string, number | number[]>;
type TexturePresets = {
    standard: TexturePreset;
} & Record<string, TexturePreset>;
interface TextureSource {
    name: string;
    glsl: string;
    ranges: Record<string, TextureRange>;
    presets: TexturePresets;
}
type TextureChannel = 'color' | 'normal';
interface TextureRenderer {
    render(params?: TexturePreset): void;
    dispose(): void;
}
interface RendererOptions {
    worldSize?: number;
    channel?: TextureChannel;
    tile?: boolean;
}
interface BakeOptions extends RendererOptions {
    size?: {
        width: number;
        height: number;
    };
    params?: TexturePreset;
}
interface Texture extends TextureSource {
    entry: string;
    bake(options?: BakeOptions): ImageBitmap;
    renderer(canvas: HTMLCanvasElement, options?: RendererOptions): TextureRenderer;
}
declare const xtextures: {
    wood: Texture;
    tatami: Texture;
    carpet: Texture;
};

export { xaudio, xbasics, xicons, xnew, xsync, xtextures };
