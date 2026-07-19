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

    // unit.element is the container; its div children are the meter first, then the status readout
    // (the hidden input is a child too but an <input>, not a <div>)
    function containerOf(unit: xnew.Unit): HTMLElement {
        return unit.element as HTMLElement;
    }

    function inputOf(unit: xnew.Unit): HTMLInputElement {
        return containerOf(unit).querySelector('input') as HTMLInputElement;
    }

    function meterOf(unit: xnew.Unit): HTMLElement {
        return containerOf(unit).querySelectorAll('div')[0] as HTMLElement;
    }

    function statusOf(unit: xnew.Unit): HTMLElement {
        return containerOf(unit).querySelectorAll('div')[1] as HTMLElement;
    }

    it('nests a hidden native range input with the given attributes', () => {
        const unit = xnew(InputRange, { value: 30, min: 10, max: 50, step: 5 });
        const input = inputOf(unit);

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

        expect(inputOf(unit).value).toBe('20');
        expect(meterOf(unit).style.width).toBe('0%');
    });

    it('updates the meter width on input', () => {
        const unit = xnew(InputRange, { value: 0 });
        const input = inputOf(unit);
        jest.advanceTimersByTime(0);

        input.value = '75';
        input.dispatchEvent(new Event('input', { bubbles: true }));

        expect(meterOf(unit).style.width).toBe('75%');
    });

    it('shows the current value in the status readout', () => {
        const unit = xnew(InputRange, { value: 30 });
        const input = inputOf(unit);
        jest.advanceTimersByTime(0);

        expect(statusOf(unit).textContent).toBe('30');

        input.value = '75';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        expect(statusOf(unit).textContent).toBe('75');
    });

    it('delivers a numeric value to input listeners', () => {
        const unit = xnew(InputRange, { value: 0 });
        const input = inputOf(unit);

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
        const input = inputOf(unit);
        jest.advanceTimersByTime(0);

        input.value = '75';
        input.dispatchEvent(new Event('input', { bubbles: true }));

        expect(meterOf(unit).style.height).toBe('75%');
        expect(statusOf(unit).textContent).toBe('75');
    });

    it('sets the name attribute only when given', () => {
        const named = xnew(InputRange, { name: 'volume' });
        const anonymous = xnew(InputRange);

        expect(inputOf(named).getAttribute('name')).toBe('volume');
        expect(inputOf(anonymous).hasAttribute('name')).toBe(false);
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

    it('omits the default meter and status when composed by the caller', () => {
        const unit = xnew(InputRange, { value: 30 }, () => {});

        expect(containerOf(unit).querySelectorAll('div')).toHaveLength(0);
        expect(inputOf(unit).tagName).toBe('INPUT');
    });
});
