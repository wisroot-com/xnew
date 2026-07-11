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

    // container children: the background first, then the meter
    function meterOf(unit: xnew.Unit): HTMLElement {
        return unit.element.parentElement?.querySelectorAll('div')[1] as HTMLElement;
    }

    it('nests a hidden native range input with the given attributes', () => {
        const unit = xnew(InputRange, { value: 30, min: 10, max: 50, step: 5 });
        const input = unit.element as HTMLInputElement;

        expect(input.tagName).toBe('INPUT');
        expect(input.type).toBe('range');
        expect(input.min).toBe('10');
        expect(input.max).toBe('50');
        expect(input.step).toBe('5');
        expect(input.value).toBe('30');
    });

    it('sets the initial meter width from value / min / max', () => {
        const unit = xnew(InputRange, { value: 30, min: 10, max: 50 });

        expect(meterOf(unit).style.width).toBe('50%');
    });

    it('defaults value to min (empty meter)', () => {
        const unit = xnew(InputRange, { min: 20, max: 100 });

        expect((unit.element as HTMLInputElement).value).toBe('20');
        expect(meterOf(unit).style.width).toBe('0%');
    });

    it('updates the meter width on input', () => {
        const unit = xnew(InputRange, { value: 0 });
        const input = unit.element as HTMLInputElement;
        jest.advanceTimersByTime(0);

        input.value = '75';
        input.dispatchEvent(new Event('input', { bubbles: false }));

        expect(meterOf(unit).style.width).toBe('75%');
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

    it('grows the meter width only (height stays free)', () => {
        const unit = xnew(InputRange, { value: 50 });
        const meter = meterOf(unit);

        expect(meter.style.width).toBe('50%');
        expect(meter.style.height).toBe('');
    });

    it('sets the name attribute only when given', () => {
        const named = xnew(InputRange, { name: 'volume' });
        const anonymous = xnew(InputRange);

        expect((named.element as HTMLInputElement).getAttribute('name')).toBe('volume');
        expect((anonymous.element as HTMLInputElement).hasAttribute('name')).toBe(false);
    });

    it('marks the max extent with a background fainter than the meter border', () => {
        const unit = xnew(InputRange, { value: 30 });
        const background = unit.element.parentElement?.querySelector('div') as HTMLElement;
        const styleText = [...document.head.querySelectorAll('style')].map((s) => s.textContent).join('\n');

        expect(background.className).toMatch(/xnew\d+-background/);
        expect(styleText).toContain('border: 1px solid color-mix(in srgb, currentColor 40%, transparent);');
        expect(styleText).toContain('inset: 0;');
    });

    it('applies className and style to the container (exposed via the getter)', () => {
        const unit = xnew(InputRange, { className: 'gauge', style: 'height: 2em;' });

        expect(unit.container).toBe(unit.element.parentElement);
        expect(unit.container.className).toContain('gauge');
        expect(unit.container.getAttribute('style')).toContain('height: 2em;');
    });

    it('applies designs to the background and meter parts', () => {
        const unit = xnew(InputRange, {
            designs: {
                background: { className: 'rail', style: 'border-radius: 0;' },
                meter: { className: 'gold', style: 'background: gold;' },
            },
        });
        const background = unit.element.parentElement?.querySelectorAll('div')[0] as HTMLElement;
        const meter = meterOf(unit);

        expect(background.className).toContain('rail');
        expect(background.getAttribute('style')).toContain('border-radius: 0;');
        expect(meter.className).toContain('gold');
        expect(meter.getAttribute('style')).toContain('background: gold;');
    });
});
