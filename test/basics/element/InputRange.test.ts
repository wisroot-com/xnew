import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';
import { InputRange } from '../../../src/basics/element/InputRange';

describe('basics InputRange', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        Unit.reset();
    });
    afterEach(() => {
        Unit.engineRoot?.destroy();
        jest.useRealTimers();
    });

    // unit.current is the container; its div children are the meter first, then the status readout
    // (the hidden input is a child too but an <input>, not a <div>)
    function containerOf(unit: xnew.Unit): HTMLElement {
        return unit.current as HTMLElement;
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

    // every value event a host would see, tagged by type, in order
    function record(unit: xnew.Unit): Array<[string, unknown]> {
        const seen: Array<[string, unknown]> = [];
        unit.on('input change', ({ event, value }: { event: Event, value: unknown }) => seen.push([event.type, value]));
        jest.advanceTimersByTime(0);
        return seen;
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

    it('derives step from the range width when unspecified (~100 steps on the 1 / 5 scale)', () => {
        expect(inputOf(xnew(InputRange)).step).toBe('1');                              // d = 100
        expect(inputOf(xnew(InputRange, { min: 0, max: 10 })).step).toBe('0.1');       // d = 10
        expect(inputOf(xnew(InputRange, { min: 0, max: 1 })).step).toBe('0.01');       // d = 1
        expect(inputOf(xnew(InputRange, { min: 0, max: 40 })).step).toBe('0.5');       // d = 40 → 0.4 snaps up
        expect(inputOf(xnew(InputRange, { min: 0, max: 500 })).step).toBe('5');        // d = 500
        expect(inputOf(xnew(InputRange, { min: -1000, max: 1000 })).step).toBe('10');  // d = 2000 → 20 snaps down
        expect(inputOf(xnew(InputRange, { min: 50, max: 50 })).step).toBe('1');        // degenerate range
    });

    it('keeps an explicit step over the derived one', () => {
        expect(inputOf(xnew(InputRange, { min: 0, max: 1000, step: 1 })).step).toBe('1');
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
        expect(styleText).toContain('box-shadow: inset 0 0 0 1px color-mix(in srgb, currentColor 40%, transparent);');
    });

    it('applies className and style to the container element', () => {
        const unit = xnew(InputRange, { className: 'gauge', style: 'height: 2em;' });

        expect(containerOf(unit).className).toContain('gauge');
        expect(containerOf(unit).getAttribute('style')).toContain('height: 2em;');
    });

    it('omits the default meter and status when composed by the caller', () => {
        const unit = xnew(() => {
            xnew.extend(InputRange, { value: 30 });
        });

        expect(containerOf(unit).querySelectorAll('div')).toHaveLength(0);
        expect(inputOf(unit).tagName).toBe('INPUT');
    });

    it('fires the native input + change pair on a .value set', () => {
        const unit = xnew(InputRange, { value: 0 });
        const seen = record(unit);

        unit.value = 60;

        expect(seen).toEqual([['input', 60], ['change', 60]]);
    });

    it('reads and writes the number through .value, keeping the meter and status in step', () => {
        const unit = xnew(InputRange, { value: 30, min: 0, max: 100 });
        jest.advanceTimersByTime(0);

        expect(unit.value).toBe(30);

        unit.value = 75;

        expect(unit.value).toBe(75);
        expect(inputOf(unit).value).toBe('75');
        expect(meterOf(unit).style.width).toBe('75%');
        expect(statusOf(unit).textContent).toBe('75');
    });

    it('confines an out-of-range .value set to min / max, announcing the stored number', () => {
        const unit = xnew(InputRange, { value: 30, min: 0, max: 100, step: 1 });
        const seen = record(unit);

        unit.value = 500;

        expect(unit.value).toBe(100);
        expect(inputOf(unit).value).toBe('100');
        expect(seen).toEqual([['input', 100], ['change', 100]]);

        unit.value = -20;

        expect(unit.value).toBe(0);
        expect(seen).toEqual([['input', 100], ['change', 100], ['input', 0], ['change', 0]]);
    });

    it('keeps the meter and status on the clamped number', () => {
        const unit = xnew(InputRange, { value: 30, min: 0, max: 100, step: 1 });
        jest.advanceTimersByTime(0);

        unit.value = 500;

        expect(meterOf(unit).style.width).toBe('100%');
        expect(statusOf(unit).textContent).toBe('100');
    });

    // the meter / status listen on the shared container, so the refired event reaches host listeners too
    it('refires input to host listeners on a programmatic .value set', () => {
        const unit = xnew(InputRange, { value: 0 });

        const received: number[] = [];
        unit.on('input', ({ value }: { value: number }) => received.push(value));
        jest.advanceTimersByTime(0);

        unit.value = 60;

        expect(received).toEqual([60]);
    });

    it('exposes the hidden native range through .input', () => {
        const unit = xnew(InputRange, { value: 30 });

        expect(unit.input).toBe(inputOf(unit));
        expect(unit.input.value).toBe('30');
    });
});
