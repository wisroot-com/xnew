import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';
import { InputText } from '../../../src/basics/element/InputText';

describe('basics InputText', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        Unit.reset();
    });
    afterEach(() => {
        Unit.engineRoot?.destroy();
        jest.useRealTimers();
    });

    it('nests a native text input inside a container with the given value and placeholder', () => {
        const unit = xnew(InputText, { value: 'hello', placeholder: 'type here' });
        const container = unit.current as HTMLElement;
        const input = container.querySelector('input') as HTMLInputElement;

        expect(container.tagName).toBe('DIV');
        expect(input.tagName).toBe('INPUT');
        expect(input.getAttribute('type')).toBe('text');
        expect(input.value).toBe('hello');
        expect(input.placeholder).toBe('type here');
    });

    it('keeps arbitrary text intact (value is set as a property, not markup)', () => {
        const unit = xnew(InputText, { value: '<b>"a" & \'b\'</b>' });
        const input = unit.current.querySelector('input') as HTMLInputElement;

        expect(input.value).toBe('<b>"a" & \'b\'</b>');
    });

    it('reads and writes the string through .value', () => {
        const unit = xnew(InputText, { value: 'hello' });
        const input = unit.current.querySelector('input') as HTMLInputElement;

        expect(unit.value).toBe('hello');

        unit.value = 'world';
        expect(input.value).toBe('world');
        expect(unit.value).toBe('world');
    });

    it('exposes the inner input element through .input', () => {
        const unit = xnew(InputText, { value: 'hello' });
        const input = unit.current.querySelector('input') as HTMLInputElement;

        expect(unit.input).toBe(input);

        input.value = 'world';
        expect(unit.input.value).toBe('world');
    });

    it('sets the name attribute only when given', () => {
        const named = xnew(InputText, { name: 'title' });
        const anonymous = xnew(InputText);

        expect((named.current.querySelector('input') as HTMLInputElement).getAttribute('name')).toBe('title');
        expect((anonymous.current.querySelector('input') as HTMLInputElement).hasAttribute('name')).toBe(false);
    });

    it('routes a click on the container to focus the inner input', () => {
        const unit = xnew(InputText);
        const container = unit.current as HTMLElement;
        const input = container.querySelector('input') as HTMLInputElement;

        jest.advanceTimersByTime(0);
        container.dispatchEvent(new Event('click', { bubbles: true }));

        expect(document.activeElement).toBe(input);
    });

    it('delivers a string value to input listeners (the native event bubbles to the container)', () => {
        const unit = xnew(InputText);
        const input = unit.current.querySelector('input') as HTMLInputElement;

        const received: string[] = [];
        unit.on('input', ({ value }: { value: string }) => received.push(value));
        jest.advanceTimersByTime(0);
        input.value = 'abc';
        input.dispatchEvent(new Event('input', { bubbles: true }));

        expect(received).toEqual(['abc']);
    });

    it('applies className and style to the container', () => {
        const unit = xnew(InputText, { className: 'boxed', style: 'width: 8em;' });
        const container = unit.current as HTMLElement;

        expect(container.className).toContain('boxed');
        expect(container.getAttribute('style')).toContain('width: 8em;');
    });
});
