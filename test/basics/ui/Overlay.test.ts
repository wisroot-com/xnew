import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';
import { Overlay } from '../../../src/basics/ui/Overlay';

describe('basics Overlay', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        Unit.reset();
    });
    afterEach(() => {
        Unit.engineRoot?.finalize();
        jest.useRealTimers();
    });

    function mockRect(element: Element, rect: Partial<DOMRect>): void {
        element.getBoundingClientRect = () => ({
            left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0,
            toJSON: () => ({}), ...rect,
        }) as DOMRect;
    }

    it('nests a full-viewport backdrop and ends on it when no anchor is given', () => {
        const overlay = xnew(Overlay, {});
        const backdrop = overlay.element as HTMLElement;
        const styleText = [...document.head.querySelectorAll('style')].map((s) => s.textContent).join('\n');

        expect(styleText).toContain('position: fixed; inset: 0; z-index: 1000;');
        // the body ends on the backdrop itself (no inner tether box)
        expect(backdrop.className).toMatch(/xnew\d+-container/);
    });

    it('adds a tether box that mirrors the anchor rect and re-syncs each update tick', () => {
        const anchor = document.createElement('div');
        mockRect(anchor, { left: 10, top: 20, width: 100, height: 40 });

        const overlay = xnew(Overlay, { anchor });
        const box = overlay.element as HTMLElement; // the body ends on the tether box
        const styleText = [...document.head.querySelectorAll('style')].map((s) => s.textContent).join('\n');

        expect(styleText).toContain('position: absolute; box-sizing: border-box;');
        expect(box.className).toMatch(/xnew\d+-tether/);
        // the box lives on the backdrop
        expect((box.parentElement as HTMLElement).className).toMatch(/xnew\d+-container/);

        // the initial sync runs synchronously in the body
        expect(box.style.left).toBe('10px');
        expect(box.style.top).toBe('20px');
        expect(box.style.width).toBe('100px');
        expect(box.style.height).toBe('40px');

        // moving the anchor and ticking re-aligns the box
        mockRect(anchor, { left: 30, top: 50, width: 120, height: 60 });
        Unit.update(Unit.engineRoot!);
        expect(box.style.left).toBe('30px');
        expect(box.style.top).toBe('50px');
        expect(box.style.width).toBe('120px');
        expect(box.style.height).toBe('60px');
    });

    it('has no built-in click-to-close; closing is the caller\'s responsibility', () => {
        const anchor = document.createElement('div');
        mockRect(anchor, { left: 0, top: 0, width: 10, height: 10 });

        const overlay = xnew(Overlay, { anchor });
        const box = overlay.element as HTMLElement;
        let finalized = false;
        overlay.on('finalize', () => { finalized = true; });
        overlay.gate.on('-closed', () => overlay.finalize());

        overlay.gate.open();
        jest.advanceTimersByTime(1000);

        // a press anywhere on the overlay never closes it on its own — the caller wires close (see the gate example)
        box.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        jest.advanceTimersByTime(1000);
        expect(finalized).toBe(false);
    });

    it('is click-through while fully closed and interactive once opened', () => {
        const overlay = xnew(Overlay, { gate: { open: false, duration: 200 } });
        const backdrop = overlay.element as HTMLElement;

        // the deferred initial emit lands the closed state: transparent; while closed the backdrop is
        // click-through via its CSS default (pointer-events: none), so the inline override stays empty
        jest.advanceTimersByTime(0);
        expect(backdrop.style.opacity).toBe('0');
        expect(backdrop.style.pointerEvents).toBe('');

        // opening turns the backdrop opaque and interactive
        overlay.gate.open();
        jest.advanceTimersByTime(250);
        expect(backdrop.style.opacity).toBe('1');
        expect(backdrop.style.pointerEvents).toBe('auto');

        // closing returns it to click-through so a mounted-but-closed Overlay never eats page clicks
        overlay.gate.close();
        jest.advanceTimersByTime(250);
        expect(backdrop.style.opacity).toBe('0');
        expect(backdrop.style.pointerEvents).toBe('none');
    });

    it('accepts a unit as the anchor and reads its element rect', () => {
        const anchorUnit = xnew('<div>');
        mockRect(anchorUnit.element, { left: 5, top: 5, width: 50, height: 50 });

        const overlay = xnew(Overlay, { anchor: anchorUnit });
        const box = overlay.element as HTMLElement;

        expect(box.style.left).toBe('5px');
        expect(box.style.width).toBe('50px');
    });
});
