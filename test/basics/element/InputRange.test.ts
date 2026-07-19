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

    // the container is layout only; its div children are the frame ring first, then the meter, then the
    // status readout (the hidden input is the last child but is an <input>, not a <div>)
    function containerOf(unit: xnew.Unit): HTMLElement {
        return unit.element.parentElement as HTMLElement;
    }

    function meterOf(unit: xnew.Unit): HTMLElement {
        return containerOf(unit).querySelectorAll('div')[1] as HTMLElement;
    }

    function statusOf(unit: xnew.Unit): HTMLElement {
        return containerOf(unit).querySelectorAll('div')[2] as HTMLElement;
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
        input.dispatchEvent(new Event('input', { bubbles: true }));

        expect(meterOf(unit).style.width).toBe('75%');
    });

    it('shows the current value in the status readout', () => {
        const unit = xnew(InputRange, { value: 30 });
        const input = unit.element as HTMLInputElement;
        jest.advanceTimersByTime(0);

        expect(statusOf(unit).textContent).toBe('30');

        input.value = '75';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        expect(statusOf(unit).textContent).toBe('75');
    });

    it('delivers a numeric value to input listeners', () => {
        const unit = xnew(InputRange, { value: 0 });
        const input = unit.element as HTMLInputElement;

        const received: number[] = [];
        unit.on('input', ({ value }: { value: number }) => received.push(value));
        jest.advanceTimersByTime(0);
        input.value = '40';
        input.dispatchEvent(new Event('input', { bubbles: true }));

        expect(received).toEqual([40]);
    });

    it('grows the meter width only (height stays free)', () => {
        const unit = xnew(InputRange, { value: 50 });
        const meter = meterOf(unit);

        expect(meter.style.width).toBe('50%');
        expect(meter.style.height).toBe('');
    });

    it('grows the meter height only when vertical (width stays free)', () => {
        const unit = xnew(InputRange, { value: 50, vertical: true });
        const meter = meterOf(unit);

        expect(meter.style.height).toBe('50%');
        expect(meter.style.width).toBe('');
    });

    it('updates the meter height on input when vertical', () => {
        const unit = xnew(InputRange, { value: 0, vertical: true });
        const input = unit.element as HTMLInputElement;
        jest.advanceTimersByTime(0);

        input.value = '75';
        input.dispatchEvent(new Event('input', { bubbles: true }));

        expect(meterOf(unit).style.height).toBe('75%');
        expect(statusOf(unit).textContent).toBe('75');
    });

    it('sets the name attribute only when given', () => {
        const named = xnew(InputRange, { name: 'volume' });
        const anonymous = xnew(InputRange);

        expect((named.element as HTMLInputElement).getAttribute('name')).toBe('volume');
        expect((anonymous.element as HTMLInputElement).hasAttribute('name')).toBe(false);
    });

    it('marks the extent with a container frame ring fainter than the meter border', () => {
        const unit = xnew(InputRange, { value: 30 });
        const styleText = [...document.head.querySelectorAll('style')].map((s) => s.textContent).join('\n');

        expect(containerOf(unit).className).toMatch(/xnew\d+-container/);
        expect(styleText).toContain('border: 1px solid color-mix(in srgb, currentColor 40%, transparent);');
    });

    it('applies className and style to the container element', () => {
        const unit = xnew(InputRange, { className: 'gauge', style: 'height: 2em;' });

        expect(containerOf(unit).className).toContain('gauge');
        expect(containerOf(unit).getAttribute('style')).toContain('height: 2em;');
    });

    it('applies attributes to the meter and status parts', () => {
        const unit = xnew(InputRange, {
            attributes: {
                meter: { className: 'gold', style: 'background: gold;' },
                status: { className: 'label', style: 'color: red;' },
            },
        });
        const meter = meterOf(unit);
        const status = statusOf(unit);

        expect(meter.className).toContain('gold');
        expect(meter.getAttribute('style')).toContain('background: gold;');
        expect(status.className).toContain('label');
        expect(status.getAttribute('style')).toContain('color: red;');
    });
});
