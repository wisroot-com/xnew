import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';
import { InputNumber, InputText } from '../../../src/basics/element/InputField';

describe('basics InputNumber', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        Unit.reset();
    });
    afterEach(() => {
        Unit.engineRoot?.destroy();
        jest.useRealTimers();
    });

    // every value event a host would see, tagged by type, in order
    function record(unit: xnew.Unit): Array<[string, unknown]> {
        const seen: Array<[string, unknown]> = [];
        unit.on('input change', ({ event, value }: { event: Event, value: unknown }) => seen.push([event.type, value]));
        jest.advanceTimersByTime(0);
        return seen;
    }

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

    it('fires the native input + change pair on a .value set', () => {
        const unit = xnew(InputNumber, { value: 30 });
        const seen = record(unit);

        unit.value = 42;

        expect(seen).toEqual([['input', 42], ['change', 42]]);
    });

    it('reads and writes the number through .value', () => {
        const unit = xnew(InputNumber, { value: 30 });
        const input = unit.current.querySelector('input') as HTMLInputElement;

        expect(unit.value).toBe(30);

        unit.value = 42;
        expect(input.value).toBe('42');
        expect(unit.value).toBe(42);
    });

    it('confines an out-of-range .value set to the min / max attributes, announcing the stored number', () => {
        const unit = xnew(InputNumber, { value: 30, min: 10, max: 50 });
        const seen = record(unit);

        unit.value = 500;

        expect(unit.value).toBe(50);
        expect((unit.current.querySelector('input') as HTMLInputElement).value).toBe('50');
        expect(seen).toEqual([['input', 50], ['change', 50]]);
    });

    it('leaves a .value set unbounded when no min / max is given', () => {
        const unit = xnew(InputNumber, { value: 30 });

        unit.value = 500;

        expect(unit.value).toBe(500);
    });

    it('reads .value as NaN while the field is empty', () => {
        expect(Number.isNaN(xnew(InputNumber).value)).toBe(true);
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

    // the shared Field core applies the number chrome off `type`, so only a number field carries it
    it('drops the native spinner and centres the digits, leaving a text field bare', () => {
        const number = xnew(InputNumber, {});
        const text = xnew(InputText, {});
        const styleText = [...document.head.querySelectorAll('style')].map((style) => style.textContent).join('\n');

        // the head of each class rule the input carries; nested rules follow, so stopping at the first brace is enough
        function inputRules(unit: xnew.Unit): string {
            const input = (unit.current as HTMLElement).querySelector('input') as HTMLInputElement;
            return [...input.classList].map((name) => {
                const start = styleText.indexOf('.' + name + ' {');
                return start < 0 ? '' : styleText.slice(start, styleText.indexOf('}', start));
            }).join('\n');
        }

        expect(inputRules(number)).toContain('appearance: textfield');
        expect(inputRules(number)).toContain('text-align: center');
        expect(inputRules(text)).not.toContain('appearance: textfield');
        expect(inputRules(text)).not.toContain('text-align: center');
    });
});
