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

    it('applies className and style to the container (exposed via the getter)', () => {
        const unit = xnew(InputNumber, { className: 'boxed', style: 'width: 4em;' });

        expect(unit.container).toBe(unit.element.parentElement);
        expect(unit.container.className).toContain('boxed');
        expect(unit.container.getAttribute('style')).toContain('width: 4em;');
    });

    it('applies designs to the field part', () => {
        const unit = xnew(InputNumber, { designs: { field: { className: 'mono', style: 'text-align: left;' } } });
        const input = unit.element as HTMLInputElement;

        expect(input.className).toContain('mono');
        expect(input.getAttribute('style')).toContain('text-align: left;');
    });
});
