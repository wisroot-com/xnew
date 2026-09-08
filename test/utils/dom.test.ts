import { EventBinder, dispatchChange, isDOMElement } from '../../src/utils/dom';

//----------------------------------------------------------------------------------------------------
// dom — DOMElement type guard (isDOMElement) + EventBinder (DOM event binding).
//
// Real public surface (verified against src/core/dom.ts):
//   new EventBinder()                                   — no constructor args
//   add(element, type, listener, options?)          — element first, then type, then listener
//   remove(type, listener)                          — note: NO element argument
//
// Registration is deferred by one setTimeout(.., 0) tick (see listen()). With fake timers,
// jest.runOnlyPendingTimers() flushes that tick so the native listener is attached.
//
// Normalized payload per family (the object the listener receives):
//   basic / window.* / document.* / window.keydown|keyup : { event }
//   (mouse* / touch* have no special handler — they bind as basic { event })
//   change / input                                        : { event, value }
//   click / pointer* / *.outside                          : { event, position: { x, y } }
//   wheel                                                 : { event, delta: { x, y } }
//   window.keydown|keyup .arrow / .wasd                   : { event, vector: { x, y } }
//   resize                                                : {}
//   drag*                                                 : { event, position, delta }
//----------------------------------------------------------------------------------------------------

const RECT = {
    left: 10, top: 20, right: 0, bottom: 0, width: 0, height: 0, x: 10, y: 20, toJSON() {},
} as DOMRect;

describe('EventBinder', () => {
    let element: HTMLElement;
    let binder: EventBinder;

    beforeEach(() => {
        jest.useFakeTimers();
        element = document.createElement('div');
        document.body.appendChild(element);
        binder = new EventBinder();
    });

    afterEach(() => {
        element.remove();
        jest.useRealTimers();
    });

    describe('deferred registration', () => {
        it('defers registration by one tick', () => {
            const listener = jest.fn();
            binder.add(element, 'click', listener);

            // Before the deferred tick: native listener is not attached yet.
            element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            expect(listener).not.toHaveBeenCalled();

            jest.runOnlyPendingTimers();
            element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            expect(listener).toHaveBeenCalledTimes(1);
        });

        it('remove() cancels a pending registration before the tick', () => {
            const listener = jest.fn();
            binder.add(element, 'click', listener);
            binder.remove('click', listener);

            jest.runOnlyPendingTimers();
            element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            expect(listener).not.toHaveBeenCalled();
        });

        it('remove() stops a registered listener after the tick', () => {
            const listener = jest.fn();
            binder.add(element, 'click', listener);
            jest.runOnlyPendingTimers();

            binder.remove('click', listener);
            element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            expect(listener).not.toHaveBeenCalled();
        });

        // removeEventListener only matches when the capture flag matches, so the original options must reach it
        it('remove() stops a listener registered with capture', () => {
            const listener = jest.fn();
            binder.add(element, 'click', listener, { capture: true });
            jest.runOnlyPendingTimers();

            binder.remove('click', listener);
            element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            expect(listener).not.toHaveBeenCalled();
        });

        it('remove() stops a listener registered with the boolean capture form', () => {
            const listener = jest.fn();
            binder.add(element, 'click', listener, true);
            jest.runOnlyPendingTimers();

            binder.remove('click', listener);
            element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            expect(listener).not.toHaveBeenCalled();
        });
    });

    describe('pointer / click position', () => {
        beforeEach(() => {
            jest.spyOn(element, 'getBoundingClientRect').mockReturnValue(RECT);
        });

        it('passes { event, position } for a click (clientXY minus rect origin)', () => {
            const listener = jest.fn();
            binder.add(element, 'click', listener);
            jest.runOnlyPendingTimers();

            const event = new MouseEvent('click', { clientX: 25, clientY: 45, bubbles: true });
            element.dispatchEvent(event);

            expect(listener).toHaveBeenCalledTimes(1);
            expect(listener).toHaveBeenCalledWith({ event, position: { x: 15, y: 25 } });
        });

        it('binds mousedown as a basic { event } listener (no special handler)', () => {
            const listener = jest.fn();
            binder.add(element, 'mousedown', listener);
            jest.runOnlyPendingTimers();

            const event = new MouseEvent('mousedown', { clientX: 30, clientY: 70, bubbles: true });
            element.dispatchEvent(event);

            expect(listener).toHaveBeenCalledWith({ event });
        });

        it('passes { event, position } for a pointerdown', () => {
            const listener = jest.fn();
            binder.add(element, 'pointerdown', listener);
            jest.runOnlyPendingTimers();

            const event = new MouseEvent('pointerdown', { clientX: 10, clientY: 20, bubbles: true });
            element.dispatchEvent(event);

            expect(listener).toHaveBeenCalledWith({ event, position: { x: 0, y: 0 } });
        });
    });

    describe('click.outside', () => {
        it('fires only when the event target is outside the element', () => {
            jest.spyOn(element, 'getBoundingClientRect').mockReturnValue(RECT);
            const inside = document.createElement('span');
            element.appendChild(inside);
            const outside = document.createElement('button');
            document.body.appendChild(outside);

            const listener = jest.fn();
            binder.add(element, 'click.outside', listener);
            jest.runOnlyPendingTimers();

            // Click inside the element: ignored.
            inside.dispatchEvent(new MouseEvent('click', { clientX: 25, clientY: 45, bubbles: true }));
            expect(listener).not.toHaveBeenCalled();

            // Click outside the element: fires with normalized position.
            outside.dispatchEvent(new MouseEvent('click', { clientX: 25, clientY: 45, bubbles: true }));
            expect(listener).toHaveBeenCalledTimes(1);
            expect(listener.mock.calls[0][0]).toMatchObject({ position: { x: 15, y: 25 } });

            outside.remove();
        });
    });

    describe('change / input value extraction', () => {
        it('extracts a text input value on change', () => {
            const input = document.createElement('input');
            input.type = 'text';
            input.value = 'hello';
            document.body.appendChild(input);

            const listener = jest.fn();
            binder.add(input, 'change', listener);
            jest.runOnlyPendingTimers();

            const event = new Event('change', { bubbles: true });
            input.dispatchEvent(event);

            expect(listener).toHaveBeenCalledWith({ event, value: 'hello' });
            input.remove();
        });

        it('extracts a checkbox checked state on change', () => {
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = true;
            document.body.appendChild(input);

            const listener = jest.fn();
            binder.add(input, 'change', listener);
            jest.runOnlyPendingTimers();

            const event = new Event('change', { bubbles: true });
            input.dispatchEvent(event);

            expect(listener).toHaveBeenCalledWith({ event, value: true });
            input.remove();
        });

        it('parses a number/range value as a float on input', () => {
            const input = document.createElement('input');
            input.type = 'range';
            input.value = '42';
            document.body.appendChild(input);

            const listener = jest.fn();
            binder.add(input, 'input', listener);
            jest.runOnlyPendingTimers();

            const event = new Event('input', { bubbles: true });
            input.dispatchEvent(event);

            expect(listener).toHaveBeenCalledWith({ event, value: 42 });
            input.remove();
        });

        it('takes the value from detail for a control dispatching its own change', () => {
            const box = document.createElement('div');
            document.body.appendChild(box);

            const listener = jest.fn();
            binder.add(box, 'change', listener);
            jest.runOnlyPendingTimers();

            dispatchChange(box, '#00ff00');

            expect(listener).toHaveBeenCalledWith({ event: expect.anything(), value: '#00ff00' });
            box.remove();
        });

        // the value rides in detail rather than on the target, so an ancestor listener still reads it
        it('carries the dispatched value up to an ancestor listener', () => {
            const outer = document.createElement('div');
            const inner = document.createElement('div');
            outer.appendChild(inner);
            document.body.appendChild(outer);

            const listener = jest.fn();
            binder.add(outer, 'change', listener);
            jest.runOnlyPendingTimers();

            dispatchChange(inner, 7);

            expect(listener).toHaveBeenCalledWith({ event: expect.anything(), value: 7 });
            outer.remove();
        });

        it('passes a dispatched value of any type through untouched', () => {
            const box = document.createElement('div');
            document.body.appendChild(box);

            const values: unknown[] = [];
            binder.add(box, 'change', ({ value }: { value: unknown }) => values.push(value));
            jest.runOnlyPendingTimers();

            dispatchChange(box, false);
            dispatchChange(box, null);
            dispatchChange(box, { id: 1 });

            expect(values).toEqual([false, null, { id: 1 }]);
            box.remove();
        });
    });

    describe('wheel', () => {
        it('passes { event, delta } from standard deltaX/deltaY', () => {
            const listener = jest.fn();
            binder.add(element, 'wheel', listener);
            jest.runOnlyPendingTimers();

            const event = new WheelEvent('wheel', { deltaX: -30, deltaY: 120, bubbles: true });
            element.dispatchEvent(event);

            expect(listener).toHaveBeenCalledWith({ event, delta: { x: -30, y: 120 } });
        });
    });

    describe('drag', () => {
        const pointer = (type: string, pointerId: number, clientX = 0, clientY = 0): Event => {
            const event = new MouseEvent(type, { clientX, clientY, bubbles: true });
            Object.defineProperty(event, 'pointerId', { value: pointerId });
            return event;
        };

        beforeEach(() => {
            jest.spyOn(element, 'getBoundingClientRect').mockReturnValue(RECT);
        });

        it('emits dragstart / dragmove / dragend across pointerdown → move → up', () => {
            const start = jest.fn();
            const move = jest.fn();
            const end = jest.fn();
            binder.add(element, 'dragstart', start);
            binder.add(element, 'dragmove', move);
            binder.add(element, 'dragend', end);
            jest.runOnlyPendingTimers();

            element.dispatchEvent(pointer('pointerdown', 1, 10, 20));
            expect(start).toHaveBeenCalledTimes(1);
            expect(start.mock.calls[0][0]).toMatchObject({ position: { x: 0, y: 0 }, delta: { x: 0, y: 0 } });

            jest.runOnlyPendingTimers(); // the inner window listeners attach one tick later
            window.dispatchEvent(pointer('pointermove', 1, 15, 26));
            expect(move).toHaveBeenCalledTimes(1);
            expect(move.mock.calls[0][0]).toMatchObject({ position: { x: 5, y: 6 }, delta: { x: 5, y: 6 } });

            window.dispatchEvent(pointer('pointerup', 1, 15, 26));
            expect(end).toHaveBeenCalledTimes(1);

            // after the drag ended, window listeners are detached
            window.dispatchEvent(pointer('pointermove', 1, 30, 40));
            expect(move).toHaveBeenCalledTimes(1);
        });

        it('ignores a second pointer while a drag is active', () => {
            const start = jest.fn();
            const move = jest.fn();
            binder.add(element, 'dragstart', start);
            binder.add(element, 'dragmove', move);
            jest.runOnlyPendingTimers();

            element.dispatchEvent(pointer('pointerdown', 1, 10, 20));
            element.dispatchEvent(pointer('pointerdown', 2, 50, 60));
            expect(start).toHaveBeenCalledTimes(1);
            jest.runOnlyPendingTimers(); // the inner window listeners attach one tick later

            // the second pointer lifting must not end the first pointer's drag
            window.dispatchEvent(pointer('pointerup', 2, 50, 60));
            window.dispatchEvent(pointer('pointermove', 1, 15, 26));
            expect(move).toHaveBeenCalledTimes(1);

            // a new drag is accepted once the first pointer is released
            window.dispatchEvent(pointer('pointerup', 1, 15, 26));
            element.dispatchEvent(pointer('pointerdown', 2, 50, 60));
            expect(start).toHaveBeenCalledTimes(2);
        });
    });

    describe('basic element event', () => {
        it('passes { event } for an unrecognized event type', () => {
            const listener = jest.fn();
            binder.add(element, 'focus', listener);
            jest.runOnlyPendingTimers();

            const event = new Event('focus');
            element.dispatchEvent(event);

            expect(listener).toHaveBeenCalledWith({ event });
        });
    });

    describe('window basic event', () => {
        it('strips the "window." prefix and binds on window with { event }', () => {
            const listener = jest.fn();
            binder.add(element, 'window.resize', listener);
            jest.runOnlyPendingTimers();

            const event = new Event('resize');
            window.dispatchEvent(event);

            expect(listener).toHaveBeenCalledWith({ event });
        });
    });

    describe('document basic event', () => {
        it('strips the "document." prefix and binds on document with { event }', () => {
            const listener = jest.fn();
            binder.add(element, 'document.visibilitychange', listener);
            jest.runOnlyPendingTimers();

            const event = new Event('visibilitychange');
            document.dispatchEvent(event);

            expect(listener).toHaveBeenCalledWith({ event });
        });
    });

    describe('window keyboard', () => {
        it('passes { event } for window.keydown and filters repeat events', () => {
            const listener = jest.fn();
            binder.add(element, 'window.keydown', listener);
            jest.runOnlyPendingTimers();

            const repeated = new KeyboardEvent('keydown', { code: 'KeyX', repeat: true });
            window.dispatchEvent(repeated);
            expect(listener).not.toHaveBeenCalled();

            const fresh = new KeyboardEvent('keydown', { code: 'KeyX', repeat: false });
            window.dispatchEvent(fresh);
            expect(listener).toHaveBeenCalledWith({ event: fresh });
        });

        it('accumulates arrow keys into a vector (down = +y, up = -y)', () => {
            const listener = jest.fn();
            binder.add(element, 'window.keydown.arrow', listener);
            jest.runOnlyPendingTimers();

            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp' }));
            expect(listener).toHaveBeenLastCalledWith(
                expect.objectContaining({ vector: { x: 0, y: -1 } }),
            );

            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }));
            expect(listener).toHaveBeenLastCalledWith(
                expect.objectContaining({ vector: { x: 1, y: -1 } }),
            );
        });

        it('decrements the arrow vector on keyup', () => {
            const listener = jest.fn();
            // keydown.arrow and keyup.arrow share a keymap only within one add(); the keyup
            // variant tracks its own state, so register keyup.arrow and prime keys via keydown.
            binder.add(element, 'window.keyup.arrow', listener);
            jest.runOnlyPendingTimers();

            // keydown updates the internal keymap (does not fire this listener);
            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft' }));
            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown' }));
            expect(listener).not.toHaveBeenCalled();

            // keyup on ArrowLeft fires with the remaining held key (ArrowDown => y:+1).
            window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowLeft' }));
            expect(listener).toHaveBeenLastCalledWith(
                expect.objectContaining({ vector: { x: 0, y: 1 } }),
            );
        });

        it('accumulates wasd keys into a vector (W = -y, D = +x)', () => {
            const listener = jest.fn();
            binder.add(element, 'window.keydown.wasd', listener);
            jest.runOnlyPendingTimers();

            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
            expect(listener).toHaveBeenLastCalledWith(
                expect.objectContaining({ vector: { x: 0, y: -1 } }),
            );

            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }));
            expect(listener).toHaveBeenLastCalledWith(
                expect.objectContaining({ vector: { x: 1, y: -1 } }),
            );
        });

        it('filters repeat events on the wasd binding', () => {
            const listener = jest.fn();
            binder.add(element, 'window.keydown.wasd', listener);
            jest.runOnlyPendingTimers();

            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', repeat: true }));
            expect(listener).not.toHaveBeenCalled();
        });

        it('fires a named-key binding only for the matching key', () => {
            const listener = jest.fn();
            binder.add(element, 'window.keydown.space', listener);
            jest.runOnlyPendingTimers();

            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));
            expect(listener).not.toHaveBeenCalled();

            const space = new KeyboardEvent('keydown', { code: 'Space' });
            window.dispatchEvent(space);
            expect(listener).toHaveBeenCalledTimes(1);
            expect(listener).toHaveBeenCalledWith({ event: space });
        });

        it('resolves letter / arrow aliases for named keys', () => {
            const onA = jest.fn();
            const onUp = jest.fn();
            binder.add(element, 'window.keydown.a', onA);
            binder.add(element, 'window.keyup.up', onUp);
            jest.runOnlyPendingTimers();

            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));
            window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowUp' }));
            expect(onA).toHaveBeenCalledTimes(1);
            expect(onUp).toHaveBeenCalledTimes(1);
        });

        it('always strips repeat on named keys', () => {
            const strict = jest.fn();
            binder.add(element, 'window.keydown.space', strict);
            jest.runOnlyPendingTimers();

            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', repeat: true }));
            expect(strict).not.toHaveBeenCalled();

            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', repeat: false }));
            expect(strict).toHaveBeenCalledTimes(1);
        });
    });

    describe('keyboard without the window. prefix (binds to the element, not the window)', () => {
        it('binds bare keydown to the element as a normal event (no window binding)', () => {
            const listener = jest.fn();
            binder.add(element, 'keydown', listener);
            jest.runOnlyPendingTimers();

            // window へ送っても要素のリスナには届かない（window ではなく要素にバインドされるため）
            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyX' }));
            expect(listener).not.toHaveBeenCalled();

            // 要素へ送れば通常の DOM イベントとして発火する
            const fresh = new KeyboardEvent('keydown', { code: 'KeyX' });
            element.dispatchEvent(fresh);
            expect(listener).toHaveBeenCalledWith({ event: fresh });
        });

        it('does not treat bare keydown.arrow as a window vector binding', () => {
            const listener = jest.fn();
            binder.add(element, 'keydown.arrow', listener);
            jest.runOnlyPendingTimers();

            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp' }));
            expect(listener).not.toHaveBeenCalled();
        });

        it('does not treat bare keydown.space as a window named-key binding', () => {
            const listener = jest.fn();
            binder.add(element, 'keydown.space', listener);
            jest.runOnlyPendingTimers();

            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
            expect(listener).not.toHaveBeenCalled();
        });
    });

    // jsdom does not implement ResizeObserver, so the 'resize' element binding cannot be driven.
    it.todo('passes {} for a resize binding (jsdom: ResizeObserver not implemented)');

    // dragstart/dragmove/dragend rely on real PointerEvent.pointerId capture + window pointermove/up
    // sequencing; jsdom PointerEvent does not carry pointerId, so the drag state machine cannot run.
    it.todo('passes { event, position, delta } across a drag sequence (jsdom: PointerEvent.pointerId unsupported)');
});

describe('isDOMElement', () => {
    describe('returns true for DOM elements', () => {
        it('accepts an HTMLElement', () => {
            expect(isDOMElement(document.createElement('div'))).toBe(true);
        });
        it('accepts HTML subclasses', () => {
            expect(isDOMElement(document.createElement('span'))).toBe(true);
            expect(isDOMElement(document.createElement('button'))).toBe(true);
        });
        it('accepts an SVGElement', () => {
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            expect(isDOMElement(svg)).toBe(true);
        });
        it('accepts SVG subclasses', () => {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            expect(isDOMElement(circle)).toBe(true);
        });
    });

    describe('returns false for non-elements', () => {
        it('rejects plain objects', () => {
            expect(isDOMElement({})).toBe(false);
        });
        it('rejects null and undefined', () => {
            expect(isDOMElement(null)).toBe(false);
            expect(isDOMElement(undefined)).toBe(false);
        });
        it('rejects primitives', () => {
            expect(isDOMElement('div')).toBe(false);
            expect(isDOMElement(123)).toBe(false);
            expect(isDOMElement(true)).toBe(false);
        });
        it('rejects arrays', () => {
            expect(isDOMElement([document.createElement('div')])).toBe(false);
        });
    });

    describe('SSR safety', () => {
        it('returns false (no throw) when HTMLElement is undefined', () => {
            const original = (globalThis as any).HTMLElement;
            (globalThis as any).HTMLElement = undefined;
            try {
                expect(isDOMElement({})).toBe(false);
                expect(isDOMElement(null)).toBe(false);
            } finally {
                (globalThis as any).HTMLElement = original;
            }
        });
        it('returns false (no throw) when SVGElement is undefined', () => {
            const original = (globalThis as any).SVGElement;
            (globalThis as any).SVGElement = undefined;
            try {
                expect(isDOMElement({})).toBe(false);
            } finally {
                (globalThis as any).SVGElement = original;
            }
        });
    });
});
