import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';
import { InputRange } from '../../../src/basics/element/InputRange';

describe('basics InputRange', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        Unit.reset();
    });
    afterEach(() => {
        Unit.engineRoot?.finalize();
        jest.useRealTimers();
    });

    // container children: track outline first, then the fill bar
    function fillOf(unit: xnew.Unit): HTMLElement {
        return unit.element.parentElement?.querySelectorAll('div')[1] as HTMLElement;
    }

    it('nests a hidden native range input with the given attributes', () => {
        const unit = xnew(InputRange, { value: 30, min: 10, max: 50, step: 5 });
        const input = unit.element as HTMLInputElement;

        expect(input.tagName).toBe('INPUT');
        expect(input.getAttribute('type')).toBe('range');
        expect(input.getAttribute('min')).toBe('10');
        expect(input.getAttribute('max')).toBe('50');
        expect(input.getAttribute('step')).toBe('5');
        expect(input.getAttribute('value')).toBe('30');
    });

    it('sets the initial fill width from value / min / max', () => {
        const unit = xnew(InputRange, { value: 30, min: 10, max: 50 });

        expect(fillOf(unit).style.width).toBe('50%');
    });

    it('defaults value to min (empty fill)', () => {
        const unit = xnew(InputRange, { min: 20, max: 100 });

        expect((unit.element as HTMLInputElement).getAttribute('value')).toBe('20');
        expect(fillOf(unit).style.width).toBe('0%');
    });

    it('updates the fill width on input', () => {
        const unit = xnew(InputRange, { value: 0 });
        const input = unit.element as HTMLInputElement;
        jest.advanceTimersByTime(0);

        input.value = '75';
        input.dispatchEvent(new Event('input', { bubbles: false }));

        expect(fillOf(unit).style.width).toBe('75%');
    });

    it('delivers a numeric value to input listeners', () => {
        const unit = xnew(InputRange, { value: 0 });
        const input = unit.element as HTMLInputElement;

        const received: number[] = [];
        unit.on('input', ({ value }: { value: number }) => received.push(value));
        jest.advanceTimersByTime(0);
        input.value = '40';
        input.dispatchEvent(new Event('input', { bubbles: false }));

        expect(received).toEqual([40]);
    });

    it('fills horizontally by default (width grows, native axis untouched)', () => {
        const unit = xnew(InputRange, { value: 50 });
        const fill = fillOf(unit);

        expect(fill.style.width).toBe('50%');
        expect(fill.style.height).toBe('');
        expect((unit.element as HTMLInputElement).getAttribute('style')).not.toContain('writing-mode');
    });

    it('fills vertically with orientation: vertical (height grows, native axis flipped)', () => {
        const unit = xnew(InputRange, { value: 50, orientation: 'vertical' });
        const fill = fillOf(unit);

        expect(fill.style.height).toBe('50%');
        expect(fill.style.width).toBe('');
        expect((unit.element as HTMLInputElement).getAttribute('style')).toContain('writing-mode: vertical-lr');
    });

    it('updates the fill height on input when vertical', () => {
        const unit = xnew(InputRange, { value: 0, orientation: 'vertical' });
        const input = unit.element as HTMLInputElement;
        jest.advanceTimersByTime(0);

        input.value = '75';
        input.dispatchEvent(new Event('input', { bubbles: false }));

        expect(fillOf(unit).style.height).toBe('75%');
    });

    it('sets the name attribute only when given', () => {
        const named = xnew(InputRange, { name: 'volume' });
        const anonymous = xnew(InputRange);

        expect((named.element as HTMLInputElement).getAttribute('name')).toBe('volume');
        expect((anonymous.element as HTMLInputElement).hasAttribute('name')).toBe(false);
    });

    it('outlines the track with a border fainter than the fill frame', () => {
        const unit = xnew(InputRange, { value: 30 });
        const track = unit.element.parentElement?.querySelector('div') as HTMLElement;

        expect(track.getAttribute('style')).toContain('border: 1px solid color-mix(in srgb, currentColor 40%, transparent);');
        expect(track.getAttribute('style')).toContain('inset: 0;');
    });

    it('applies className and style to the container', () => {
        const unit = xnew(InputRange, { className: 'gauge', style: 'height: 2em;' });
        const container = unit.element.parentElement as HTMLElement;

        expect(container.className).toContain('gauge');
        expect(container.getAttribute('style')).toContain('height: 2em;');
    });
});
