import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';
import { InputNumber } from '../../../src/basics/element/InputNumber';

describe('basics InputNumber', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        Unit.reset();
    });
    afterEach(() => {
        Unit.engineRoot?.finalize();
        jest.useRealTimers();
    });

    // container > [down button, input, up button]
    function spinButtonsOf(unit: xnew.Unit): HTMLElement[] {
        const container = unit.element.parentElement as HTMLElement;
        return [container.firstElementChild, container.lastElementChild] as HTMLElement[];
    }

    it('nests a native number input with the given attributes', () => {
        const unit = xnew(InputNumber, { value: 30, min: 10, max: 50, step: 5, name: 'count' });
        const input = unit.element as HTMLInputElement;

        expect(input.tagName).toBe('INPUT');
        expect(input.getAttribute('type')).toBe('number');
        expect(input.getAttribute('min')).toBe('10');
        expect(input.getAttribute('max')).toBe('50');
        expect(input.getAttribute('step')).toBe('5');
        expect(input.getAttribute('name')).toBe('count');
        expect(input.value).toBe('30');
    });

    it('omits value / min / max / step / name when not given', () => {
        const unit = xnew(InputNumber);
        const input = unit.element as HTMLInputElement;

        expect(input.value).toBe('');
        expect(input.hasAttribute('min')).toBe(false);
        expect(input.hasAttribute('max')).toBe(false);
        expect(input.hasAttribute('step')).toBe(false);
        expect(input.hasAttribute('name')).toBe(false);
    });

    it('delivers a numeric value to input listeners', () => {
        const unit = xnew(InputNumber);
        const input = unit.element as HTMLInputElement;

        const received: number[] = [];
        unit.on('input', ({ value }: { value: number }) => received.push(value));
        jest.advanceTimersByTime(0);
        input.value = '42';
        input.dispatchEvent(new Event('input', { bubbles: false }));

        expect(received).toEqual([42]);
    });

    it('delivers NaN while the field is empty', () => {
        const unit = xnew(InputNumber, { value: 1 });
        const input = unit.element as HTMLInputElement;

        const received: number[] = [];
        unit.on('input', ({ value }: { value: number }) => received.push(value));
        jest.advanceTimersByTime(0);
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: false }));

        expect(received).toHaveLength(1);
        expect(Number.isNaN(received[0])).toBe(true);
    });

    it('renders custom spin buttons flanking the field', () => {
        const unit = xnew(InputNumber);
        const [down, up] = spinButtonsOf(unit);

        expect(down.nextElementSibling).toBe(unit.element);
        expect(up.previousElementSibling).toBe(unit.element);
        expect(down.querySelector('svg')).not.toBeNull();
        expect(up.querySelector('svg')).not.toBeNull();
    });

    it('steps the value with the spin buttons and emits input', () => {
        const unit = xnew(InputNumber, { value: 10, min: 0, max: 100, step: 5 });
        const input = unit.element as HTMLInputElement;

        const received: number[] = [];
        unit.on('input', ({ value }: { value: number }) => received.push(value));
        jest.advanceTimersByTime(0);

        const [down, up] = spinButtonsOf(unit);
        up.dispatchEvent(new MouseEvent('click', { bubbles: false }));
        expect(input.value).toBe('15');
        down.dispatchEvent(new MouseEvent('click', { bubbles: false }));
        expect(input.value).toBe('10');
        expect(received).toEqual([15, 10]);
    });

    it('clamps spin button stepping at min', () => {
        const unit = xnew(InputNumber, { value: 2, min: 0, step: 5 });
        jest.advanceTimersByTime(0);

        const [down] = spinButtonsOf(unit);
        down.dispatchEvent(new MouseEvent('click', { bubbles: false }));
        down.dispatchEvent(new MouseEvent('click', { bubbles: false }));

        expect((unit.element as HTMLInputElement).value).toBe('0');
    });

    it('applies className and style to the container', () => {
        const unit = xnew(InputNumber, { className: 'field', style: 'width: 4em;' });
        const container = unit.element.parentElement as HTMLElement;

        expect(container.className).toContain('field');
        expect(container.getAttribute('style')).toContain('width: 4em;');
    });
});
