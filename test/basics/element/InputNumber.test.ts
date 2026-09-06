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

    it('nests a native number input inside a container with the given attributes', () => {
        const unit = xnew(InputNumber, { value: 30, min: 10, max: 50, step: 5, name: 'count' });
        const container = unit.current as HTMLElement;
        const input = container.querySelector('input') as HTMLInputElement;

        expect(container.tagName).toBe('DIV');
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
        const input = unit.current.querySelector('input') as HTMLInputElement;

        expect(input.value).toBe('');
        expect(input.hasAttribute('min')).toBe(false);
        expect(input.hasAttribute('max')).toBe(false);
        expect(input.hasAttribute('step')).toBe(false);
        expect(input.hasAttribute('name')).toBe(false);
    });

    it('exposes the inner input element through .input', () => {
        const unit = xnew(InputNumber, { value: 30 });
        const input = unit.current.querySelector('input') as HTMLInputElement;

        expect(unit.input).toBe(input);

        input.value = '42';
        expect(unit.input.valueAsNumber).toBe(42);
    });

    it('routes a click on the container to focus the inner input', () => {
        const unit = xnew(InputNumber);
        const container = unit.current as HTMLElement;
        const input = container.querySelector('input') as HTMLInputElement;

        jest.advanceTimersByTime(0);
        container.dispatchEvent(new Event('click', { bubbles: true }));

        expect(document.activeElement).toBe(input);
    });

    it('delivers a numeric value to input listeners (the native event bubbles to the container)', () => {
        const unit = xnew(InputNumber);
        const input = unit.current.querySelector('input') as HTMLInputElement;

        const received: number[] = [];
        unit.on('input', ({ value }: { value: number }) => received.push(value));
        jest.advanceTimersByTime(0);
        input.value = '42';
        input.dispatchEvent(new Event('input', { bubbles: true }));

        expect(received).toEqual([42]);
    });

    it('delivers NaN while the field is empty', () => {
        const unit = xnew(InputNumber, { value: 1 });
        const input = unit.current.querySelector('input') as HTMLInputElement;

        const received: number[] = [];
        unit.on('input', ({ value }: { value: number }) => received.push(value));
        jest.advanceTimersByTime(0);
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));

        expect(received).toHaveLength(1);
        expect(Number.isNaN(received[0])).toBe(true);
    });

    it('applies className and style to the container', () => {
        const unit = xnew(InputNumber, { className: 'boxed', style: 'width: 4em;' });
        const container = unit.current as HTMLElement;

        expect(container.className).toContain('boxed');
        expect(container.getAttribute('style')).toContain('width: 4em;');
    });
});
