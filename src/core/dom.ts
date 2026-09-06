//----------------------------------------------------------------------------------------------------
// dom — the boundary with the DOM (element detection + event binding)
// Special events normalize payloads via the defineEvent dictionary; everything else passes { event }
// through addEventListener. mouse / touch stay undefined on purpose (unified on pointer).
//----------------------------------------------------------------------------------------------------

import { MapMap } from './map';

export type DomElement = HTMLElement | SVGElement;

export function isDomElement(value: unknown): value is DomElement {
    return (typeof HTMLElement !== 'undefined' && value instanceof HTMLElement) || (typeof SVGElement !== 'undefined' && value instanceof SVGElement);
}

//----------------------------------------------------------------------------------------------------
// element definition object — the tag-string alternative for computed / conditional attributes
//----------------------------------------------------------------------------------------------------

export interface DomElementDef { tag: string; className?: string; style?: string; [key: string]: any; }

export function isElementDef(value: unknown): value is DomElementDef {
    return typeof value === 'object' && value !== null && isDomElement(value) === false && typeof (value as { tag?: unknown }).tag === 'string';
}

// creates a child element under parent from a tag string / definition; object-form members are assigned after creation so arbitrary text cannot break the tag string (SVG always via setAttribute — its DOM properties are read-only).
export function createElement(parent: DomElement, tag: string | DomElementDef): DomElement {
    let text: string;
    const members: [string, any][] = [];
    if (isElementDef(tag) === true) {
        if (/^[A-Za-z][A-Za-z0-9]*$/.test(tag.tag) === false) {
            throw new Error(`xnew: invalid tag name "${tag.tag}".`);
        }
        const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

        let attributes = '';
        for (const [key, value] of Object.entries(tag)) {
            if (key === 'tag' || value === undefined || value === null || value === false) {
                // skipped, so members can be conditional (name: name ? name : undefined)
            } else if (key === 'className') {
                attributes += ` class="${escape(String(value))}"`;
            } else if (key === 'style') {
                attributes += ` style="${escape(String(value))}"`;
            } else {
                members.push([key, value]);
            }
        }
        text = `<${tag.tag}${attributes}></${tag.tag}>`;
    } else {
        const match = typeof tag === 'string' ? tag.match(/<((\w+)[^>]*?)\/?>/) : null;
        if (match !== null) {
            text = `<${match[1]}></${match[2]}>`;
        } else {
            throw new Error(`xnew.nest: invalid tag string [${tag}]`);
        }
    }

    parent.insertAdjacentHTML('beforeend', text);
    const element = parent.children[parent.children.length - 1] as DomElement;

    for (const [key, value] of members) {
        if (element instanceof SVGElement) {
            // natively camelCase SVG attributes (viewBox, …) pass through; every other camelCase name becomes kebab-case (strokeWidth -> stroke-width)
            const name = svgCamelAttributes.has(key) ? key : key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
            element.setAttribute(name, String(value));
        } else if (key in element) {
            (element as any)[key] = value;
        } else {
            element.setAttribute(key, String(value));
        }
    }
    return element;
}

// SVG attribute names that are natively camelCase (kept as-is instead of being kebab-cased)
const svgCamelAttributes = new Set([
    'attributeName', 'attributeType', 'baseFrequency', 'baseProfile', 'calcMode', 'clipPathUnits',
    'diffuseConstant', 'edgeMode', 'filterUnits', 'glyphRef', 'gradientTransform', 'gradientUnits',
    'kernelMatrix', 'kernelUnitLength', 'keyPoints', 'keySplines', 'keyTimes', 'lengthAdjust',
    'limitingConeAngle', 'markerHeight', 'markerUnits', 'markerWidth', 'maskContentUnits', 'maskUnits',
    'numOctaves', 'pathLength', 'patternContentUnits', 'patternTransform', 'patternUnits',
    'pointsAtX', 'pointsAtY', 'pointsAtZ', 'preserveAlpha', 'preserveAspectRatio', 'primitiveUnits',
    'refX', 'refY', 'repeatCount', 'repeatDur', 'requiredExtensions', 'specularConstant',
    'specularExponent', 'spreadMethod', 'startOffset', 'stdDeviation', 'stitchTiles', 'surfaceScale',
    'systemLanguage', 'tableValues', 'targetX', 'targetY', 'textLength', 'viewBox',
    'xChannelSelector', 'yChannelSelector', 'zoomAndPan',
]);

interface EventProps { element: DomElement; type: string; listener: Function; options?: boolean | AddEventListenerOptions }

const factories = new Map<string, (props: EventProps) => Function>();

function attach(target: Window | Document | DomElement, type: string, execute: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): Function {
    let initialized = false;
    const id = setTimeout(() => { initialized = true; target.addEventListener(type, execute, options); }, 0);

    return () => {
        if (initialized === false) {
            clearTimeout(id);
        } else {
            // removeEventListener only matches a listener whose capture flag matches, so the original options must ride along
            target.removeEventListener(type, execute, options);
        }
    };
}

function getPointerPosition(element: DomElement, event: { clientX: number, clientY: number }): { x: number, y: number } {
    const rect = element.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

export class EventBinder {
    private map = new MapMap<string, Function, Function>();

    public add(element: DomElement, type: string, listener: Function, options?: boolean | AddEventListenerOptions): void {
        const props: EventProps = { element, type, listener, options };
        const factory = factories.get(type);
        const keyboard = type.match(/^(window|document)\.(keydown|keyup)(?:\.([A-Za-z0-9]+))?$/);

        let finalize: Function;
        if (factory !== undefined) {
            finalize = factory(props);
        } else if (keyboard !== null) {
            finalize = keyboardEvent(keyboard, props);
        } else {
            let target: Window | Document | DomElement = element;
            let name = type;
            if (type.startsWith('window.')) {
                target = window;
                name = type.substring('window.'.length);
            } else if (type.startsWith('document.')) {
                target = document;
                name = type.substring('document.'.length);
            }
            finalize = attach(target, name, (event: Event) => listener({ event }), options);
        }
        this.map.set(type, listener, finalize);
    }

    public remove(type: string, listener: Function): void {
        const finalize = this.map.get(type, listener);
        if (finalize) {
            finalize();
            this.map.delete(type, listener);
        }
    }
}

//----------------------------------------------------------------------------------------------------
// special-event dictionary
//----------------------------------------------------------------------------------------------------

// Registers a custom event factory for one or more exact type strings (last registration wins).
function defineEvent(types: string[], factory: (props: EventProps) => Function): void {
    types.forEach((type) => factories.set(type, factory));
}

defineEvent(['change', 'input'], (props: EventProps) => {
    return attach(props.element, props.type, (event: any) => {
        let value: any = null;
        if (event.target.type === 'checkbox') {
            value = event.target.checked;
        } else if (event.target.type === 'range' || event.target.type === 'number') {
            value = parseFloat(event.target.value);
        } else {
            value = event.target.value;
        }
        props.listener({ event, value });
    }, props.options);
});

defineEvent(['click', 'pointerdown', 'pointermove', 'pointerup', 'pointerover', 'pointerout'], (props: EventProps) => {
    return attach(props.element, props.type, (event: any) => {
        props.listener({ event, position: getPointerPosition(props.element, event) });
    }, props.options);
});

defineEvent(['click.outside', 'pointerdown.outside', 'pointermove.outside', 'pointerup.outside'], (props: EventProps) => {
    return attach(document, props.type.split('.')[0], (event: any) => {
        if (props.element.contains(event.target) === false) {
            props.listener({ event, position: getPointerPosition(props.element, event) });
        }
    }, props.options);
});

defineEvent(['wheel'], (props: EventProps) => {
    return attach(props.element, props.type, (event: any) => {
        props.listener({ event, delta: { x: event.deltaX, y: event.deltaY } });
    }, props.options);
});

defineEvent(['resize'], (props: EventProps) => {
    const observer = new ResizeObserver(() => props.listener({}));
    observer.observe(props.element);
    return () => observer.unobserve(props.element);
});

defineEvent(['dragstart', 'dragmove', 'dragend'], (props: EventProps) => {
    let finalizers: Function[] = [];
    const remove = () => { finalizers.forEach((finalize) => finalize()); finalizers = []; };

    const pointerdown = attach(props.element, 'pointerdown', (event: any) => {
        if (finalizers.length === 0) { // ignore other pointers while a drag is active
            const id = event.pointerId;
            let previous = getPointerPosition(props.element, event);

            const track = (kind: string) => (event: any) => {
                if (event.pointerId === id) {
                    const position = getPointerPosition(props.element, event);
                    if (props.type === kind) {
                        const delta = kind === 'dragmove' ? { x: position.x - previous.x, y: position.y - previous.y } : { x: 0, y: 0 };
                        props.listener({ event, position, delta });
                    }
                    previous = position;
                    if (kind === 'dragend') {
                        remove();
                    }
                }
            };

            finalizers = [
                attach(window, 'pointermove', track('dragmove'), props.options),
                attach(window, 'pointerup', track('dragend'), props.options),
                attach(window, 'pointercancel', track('dragend'), props.options),
            ];
            track('dragstart')(event);
        }
    }, props.options);

    return () => {
        pointerdown();
        remove();
    };
});

defineEvent(['window.keydown.arrow', 'window.keyup.arrow', 'window.keydown.wasd', 'window.keyup.wasd'], (props: EventProps) => {
    const VECTOR_CODES: Record<string, { left: string, right: string, up: string, down: string }> = {
        arrow: { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown' },
        wasd: { left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS' },
    };
    const [, variant, name] = props.type.split('.');
    const codes = VECTOR_CODES[name];
    const keymap: Record<string, number> = {};
    const targets = [codes.left, codes.right, codes.up, codes.down];
    const vector = () => ({
        x: (keymap[codes.left] ? -1 : 0) + (keymap[codes.right] ? +1 : 0),
        y: (keymap[codes.up] ? -1 : 0) + (keymap[codes.down] ? +1 : 0),
    });

    const bind = (kind: 'keydown' | 'keyup') => attach(window, kind, (event: any) => {
        if (kind === 'keyup' || !event.repeat) {
            keymap[event.code] = kind === 'keydown' ? 1 : 0;
            if (kind === variant && targets.includes(event.code)) {
                props.listener({ event, vector: vector() });
            }
        }
    }, props.options);

    const finalizers = [bind('keydown'), bind('keyup')];
    return () => finalizers.forEach((finalize) => finalize());
});

//----------------------------------------------------------------------------------------------------
// named-key filter — (window|document).(keydown|keyup).<key>: space / enter / escape(esc) / tab / up|down|left|right / a–z / 0–9; others match by code|key name
//----------------------------------------------------------------------------------------------------

// exact-match factories (.arrow / .wasd) resolve before this; repeat is always stripped
function keyboardEvent(matched: RegExpMatchArray, props: EventProps): Function {
    const [, scope, variant, rawKey] = matched;
    const key = rawKey?.toLowerCase();
    const target = scope === 'document' ? document : window;

    // <key> name → KeyboardEvent.code; names outside the table match by code|key name instead
    const codes: Record<string, string> = {
        space: 'Space', enter: 'Enter', escape: 'Escape', esc: 'Escape', tab: 'Tab',
        up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight',
    };
    'abcdefghijklmnopqrstuvwxyz'.split('').forEach((c) => codes[c] = 'Key' + c.toUpperCase());
    '0123456789'.split('').forEach((c) => codes[c] = 'Digit' + c);
    const code = key !== undefined ? codes[key] : undefined;

    return attach(target, variant, (event: any) => {
        const matches = key === undefined || (code !== undefined ? event.code === code : (event.code?.toLowerCase() === key || event.key?.toLowerCase() === key));
        if (!event.repeat && matches) {
            props.listener({ event });
        }
    }, props.options);
}
