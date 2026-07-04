//----------------------------------------------------------------------------------------------------
// dom — the boundary with the DOM (element detection + event binding)
//
// Special events normalize their payload via the defineEvent dictionary; everything else passes
// { event } through addEventListener ('window.' / 'document.' prefixes switch the bind target).
// mouse / touch stay undefined on purpose (unified on pointer); binding is deferred by 1 tick.
//
// - DomElement / isDomElement : element types xnew can host (HTML | SVG) and its type guard
// - EventBinder : manages (type, listener) → finalize, resolving dictionary → passthrough
//
// Payloads: change|input {event,value} / click|pointer* {event,position} (+ .outside) / wheel {event,delta} /
// drag* {event,position,delta} / resize {} / window|document.keydown|keyup[.arrow|.wasd|.<key>] {event[,vector]}
// (keyboard: repeat stripped, prefix required)
//----------------------------------------------------------------------------------------------------

import { MapMap } from './map';

export type DomElement = HTMLElement | SVGElement;

export function isDomElement(value: unknown): value is DomElement {
    return (typeof HTMLElement !== 'undefined' && value instanceof HTMLElement) || (typeof SVGElement !== 'undefined' && value instanceof SVGElement);
}

interface EventProps { element: DomElement; type: string; listener: Function; options?: boolean | AddEventListenerOptions }

const factories = new Map<string, (props: EventProps) => Function>();

function attach(target: Window | Document | DomElement, type: string, execute: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): Function {
    let initialized = false;
    const id = setTimeout(() => { initialized = true; target.addEventListener(type, execute, options); }, 0);

    return () => {
        if (initialized === false) {
            clearTimeout(id);
        } else {
            target.removeEventListener(type, execute);
        }
    };
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

/** Registers a custom event factory for one or more exact type strings (last registration wins). */
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

    const pointerdown = attach(props.element, 'pointerdown', (event: any) => {
        if (finalizers.length === 0) { // ignore other pointers while a drag is active
            const id = event.pointerId;
            const position = getPointerPosition(props.element, event);
            let previous = position;

            const finish = (event: any) => {
                if (event.pointerId === id) {
                    const position = getPointerPosition(props.element, event);
                    if (props.type === 'dragend') {
                        props.listener({ event, position, delta: { x: 0, y: 0 } });
                    }
                    remove();
                }
            };
            finalizers = [
                attach(window, 'pointermove', (event: any) => {
                    if (event.pointerId === id) {
                        const position = getPointerPosition(props.element, event);
                        const delta = { x: position.x - previous.x, y: position.y - previous.y };
                        if (props.type === 'dragmove') {
                            props.listener({ event, position, delta });
                        }
                        previous = position;
                    }
                }, props.options),
                attach(window, 'pointerup', finish, props.options),
                attach(window, 'pointercancel', finish, props.options),
            ];

            if (props.type === 'dragstart') {
                props.listener({ event, position, delta: { x: 0, y: 0 } });
            }
        }
    }, props.options);

    function remove() {
        finalizers.forEach((finalize) => finalize());
        finalizers = [];
    }

    return () => {
        pointerdown();
        remove();
    };
});

function getPointerPosition(element: DomElement, event: { clientX: number, clientY: number }): { x: number, y: number } {
    const rect = element.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

// Tracks the 4 keys' pressed state in keymap and emits a combined vector on their keydown / keyup.
function keyVectorEvent(variant: 'keydown' | 'keyup', codes: { left: string, right: string, up: string, down: string }): (props: EventProps) => Function {
    return (props: EventProps) => {
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
    };
}

const ARROW_CODES = { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown' };
const WASD_CODES = { left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS' };

defineEvent(['window.keydown.arrow'], keyVectorEvent('keydown', ARROW_CODES));
defineEvent(['window.keyup.arrow'], keyVectorEvent('keyup', ARROW_CODES));
defineEvent(['window.keydown.wasd'], keyVectorEvent('keydown', WASD_CODES));
defineEvent(['window.keyup.wasd'], keyVectorEvent('keyup', WASD_CODES));

//----------------------------------------------------------------------------------------------------
// named-key filter — (window|document).(keydown|keyup).<key>
//
// <key>: space / enter / escape(esc) / tab / up|down|left|right / a–z / 0–9; others match by code|key name.
//----------------------------------------------------------------------------------------------------

const KEY_ALIASES: Record<string, string> = {
    space: 'Space', enter: 'Enter', escape: 'Escape', esc: 'Escape', tab: 'Tab',
    up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight',
};

function matchKey(name: string, event: KeyboardEvent): boolean {
    if (KEY_ALIASES[name] !== undefined) return event.code === KEY_ALIASES[name];
    if (/^[a-z]$/.test(name)) return event.code === 'Key' + name.toUpperCase();
    if (/^[0-9]$/.test(name)) return event.code === 'Digit' + name;
    return event.code?.toLowerCase() === name || event.key?.toLowerCase() === name;
}

// exact-match factories (.arrow / .wasd) resolve before this; repeat is always stripped
function keyboardEvent(matched: RegExpMatchArray, props: EventProps): Function {
    const [, scope, variant, rawKey] = matched;
    const key = rawKey?.toLowerCase();
    const target = scope === 'document' ? document : window;
    return attach(target, variant, (event: any) => {
        if (!event.repeat && (key === undefined || matchKey(key, event))) {
            props.listener({ event });
        }
    }, props.options);
}
