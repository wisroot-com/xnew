//----------------------------------------------------------------------------------------------------
// dom — the boundary with the DOM (element detection + event binding)
//
// Decides what counts as a DOM element (SSR-safe type guard) and centralizes Unit's DOM event binding.
// Events pass { event } through a plain addEventListener by default ('window.' / 'document.' prefixes only
// switch the bind target); special events normalize their payload via the defineEvent(type, factory) dictionary.
// mouse / touch are intentionally undefined (unified on pointer; a plain { event } still works).
// Binding is deferred by 1 tick, so a listener attached during component init does not fire on the same tick.
//
// - DomElement / isDomElement : element types xnew can host (HTML | SVG) and its type guard
// - Eventor : manages (type, listener) → finalize, resolving dictionary → passthrough
//   (defineEvent / attach / EventProps are internal)
//
// Payload: change|input:{event,value} / click|pointer*:{event,position} / *.outside: fires outside the element /
// wheel:{event,delta} / resize:{} / drag*:{event,position,delta} /
// window.keydown|keyup:{event}(repeat stripped) / window.keydown|keyup.arrow|wasd:{event,vector} /
// (window|document).keydown|keyup.<key>:{event} (named-key filter; repeat stripped)
// Binding the keyboard to window/document requires a 'window.' / 'document.' prefix.
// Without a prefix, 'keydown' etc. bind to the unit's own element as a normal event.
//----------------------------------------------------------------------------------------------------

import { MapMap } from './map';

export type DomElement = HTMLElement | SVGElement;
type Target = Window | Document | DomElement;

export function isDomElement(value: unknown): value is DomElement {
    return (typeof HTMLElement !== 'undefined' && value instanceof HTMLElement) || (typeof SVGElement !== 'undefined' && value instanceof SVGElement);
}

interface EventProps { element: DomElement; type: string; listener: Function; options?: boolean | AddEventListenerOptions }

/** Builds the binding for one custom event type. Returns a finalizer that detaches everything. */
type EventFactory = (props: EventProps) => Function;

const factories = new Map<string, EventFactory>();

function attach(target: Target, type: string, execute: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): Function {
    let initalized = false;
    const id = setTimeout(() => {
        initalized = true;
        target.addEventListener(type, execute, options);
    }, 0);

    return () => {
        if (initalized === false) {
            clearTimeout(id);
        } else {
            target.removeEventListener(type, execute);
        }
    };
}

export class Eventor {
    private map = new MapMap<string, Function, Function>();

    public add(element: DomElement, type: string, listener: Function, options?: boolean | AddEventListenerOptions): void {
        const props: EventProps = { element, type, listener, options };
        const factory = factories.get(type) ?? keyboardFactory(type);

        let finalize: Function;
        if (factory !== undefined) {
            finalize = factory(props);
        } else if (type.startsWith('window.')) {
            finalize = attach(window, type.substring('window.'.length), (event: Event) => listener({ event }), options);
        } else if (type.startsWith('document.')) {
            finalize = attach(document, type.substring('document.'.length), (event: Event) => listener({ event }), options);
        } else {
            finalize = attach(element, type, (event: Event) => listener({ event }), options);
        }

        this.map.set(type, listener, finalize);
    }

    public remove(type: string, listener: Function): void {
        const finalize = this.map.get(type, listener);
        if (finalize) {
            finalize();
            this.map.delete(type, listener)
        }
    }
}

//----------------------------------------------------------------------------------------------------
// special-event dictionary
//----------------------------------------------------------------------------------------------------

function getPointerPosition(element: DomElement, event: { clientX: number, clientY: number }): { x: number, y: number } {
    const rect = element.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

/** Registers a custom event factory for one or more exact type strings (last registration wins). */
function defineEvent(types: string | string[], factory: EventFactory): void {
    (Array.isArray(types) ? types : [types]).forEach((type) => factories.set(type, factory));
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

defineEvent('wheel', (props: EventProps) => {
    return attach(props.element, props.type, (event: any) => {
        props.listener({ event, delta: { x: event.wheelDeltaX, y: event.wheelDeltaY } });
    }, props.options);
});

defineEvent('resize', (props: EventProps) => {
    const observer = new ResizeObserver(() => props.listener({}));
    observer.observe(props.element);
    return () => observer.unobserve(props.element);
});

// keydown/keyup bound to window (auto-repeat stripped). Requires the 'window.' prefix.
defineEvent(['window.keydown', 'window.keyup'], (props: EventProps) => {
    const type = props.type.substring('window.'.length);
    return attach(window, type, (event: any) => {
        if (event.repeat) return;
        props.listener({ event });
    }, props.options);
});

defineEvent(['dragstart', 'dragmove', 'dragend'], (props: EventProps) => {
    let pointermove: Function | null = null;
    let pointerup: Function | null = null;
    let pointercancel: Function | null = null;

    const pointerdown = attach(props.element, 'pointerdown', (event: any) => {
        const id = event.pointerId;
        const position = getPointerPosition(props.element, event);
        let previous = position;

        pointermove = attach(window, 'pointermove', (event: any) => {
            if (event.pointerId === id) {
                const position = getPointerPosition(props.element, event);
                const delta = { x: position.x - previous.x, y: position.y - previous.y };
                if (props.type === 'dragmove') {
                    props.listener({ event, position, delta });
                }
                previous = position;
            }
        }, props.options);
        const finish = (event: any) => {
            if (event.pointerId === id) {
                const position = getPointerPosition(props.element, event);
                if (props.type === 'dragend') {
                    props.listener({ event, position, delta: { x: 0, y: 0 } });
                }
                remove();
            }
        };
        pointerup = attach(window, 'pointerup', finish, props.options);
        pointercancel = attach(window, 'pointercancel', finish, props.options);

        if (props.type === 'dragstart') {
            props.listener({ event, position, delta: { x: 0, y: 0 } });
        }
    }, props.options);

    function remove() {
        pointermove?.(); pointermove = null;
        pointerup?.(); pointerup = null;
        pointercancel?.(); pointercancel = null;
    }

    return () => {
        pointerdown();
        remove();
    };
});

// Tracks the 4 keys' pressed state in keymap and emits a combined vector on their keydown / keyup.
function keyVectorEvent(variant: 'keydown' | 'keyup', codes: { left: string, right: string, up: string, down: string }): EventFactory {
    return (props: EventProps) => {
        const keymap: Record<string, number> = {};
        const targets = [codes.left, codes.right, codes.up, codes.down];
        const vector = () => ({
            x: (keymap[codes.left] ? -1 : 0) + (keymap[codes.right] ? +1 : 0),
            y: (keymap[codes.up] ? -1 : 0) + (keymap[codes.down] ? +1 : 0),
        });

        const keydown = attach(window, 'keydown', (event: any) => {
            if (event.repeat) return;
            keymap[event.code] = 1;
            if (variant === 'keydown' && targets.includes(event.code)) {
                props.listener({ event, vector: vector() });
            }
        }, props.options);
        const keyup = attach(window, 'keyup', (event: any) => {
            keymap[event.code] = 0;
            if (variant === 'keyup' && targets.includes(event.code)) {
                props.listener({ event, vector: vector() });
            }
        }, props.options);

        return () => {
            keydown();
            keyup();
        };
    };
}

const ARROW_CODES = { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown' };
const WASD_CODES = { left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS' };

// Vector events always aggregate pressed state on window (the 'window.' prefix is required).
defineEvent('window.keydown.arrow', keyVectorEvent('keydown', ARROW_CODES));
defineEvent('window.keyup.arrow', keyVectorEvent('keyup', ARROW_CODES));
defineEvent('window.keydown.wasd', keyVectorEvent('keydown', WASD_CODES));
defineEvent('window.keyup.wasd', keyVectorEvent('keyup', WASD_CODES));

//----------------------------------------------------------------------------------------------------
// named-key filter — (window|document).(keydown|keyup).<key>
//
// Notifies keydown / keyup narrowed by the trailing key name via { event } (no event.code checks needed).
// <key>: space / enter / escape(esc) / tab / up|down|left|right / a–z / 0–9. Others match by code|key name.
// auto-repeat is always stripped (same as plain keydown).
// A 'window.' / 'document.' prefix is required (explicit about where to bind); no prefix → not a named key.
// e.g. unit.on('window.keydown.space', ({ event }) => ...) / 'document.keyup.escape'
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

// Returns an EventFactory on match, else undefined (caller resolves otherwise). .arrow / .wasd never
// reach here — an exact-match factory resolves them first.
function keyboardFactory(type: string): EventFactory | undefined {
    const matched = type.match(/^(window|document)\.(keydown|keyup)\.([A-Za-z0-9]+)$/);
    if (matched === null) return undefined;
    const [, scope, variant, rawKey] = matched;
    const key = rawKey.toLowerCase();
    const target = scope === 'document' ? document : window; // 'window.' → window, 'document.' → document (prefix required)
    return (props: EventProps) => attach(target, variant, (event: any) => {
        if (event.repeat) return;
        if (matchKey(key, event)) props.listener({ event });
    }, props.options);
}
