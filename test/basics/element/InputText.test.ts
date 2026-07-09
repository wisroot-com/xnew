import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';
import { InputText } from '../../../src/basics/element/InputText';

describe('basics InputText', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        Unit.reset();
    });
    afterEach(() => {
        Unit.engineRoot?.finalize();
        jest.useRealTimers();
    });

    it('nests a native text input with the given value and placeholder', () => {
        const unit = xnew(InputText, { value: 'hello', placeholder: 'type here' });
        const input = unit.element as HTMLInputElement;

        expect(input.tagName).toBe('INPUT');
        expect(input.getAttribute('type')).toBe('text');
        expect(input.value).toBe('hello');
        expect(input.placeholder).toBe('type here');
    });

    it('keeps arbitrary text intact (value is set as a property, not markup)', () => {
        const unit = xnew(InputText, { value: '<b>"a" & \'b\'</b>' });

        expect((unit.element as HTMLInputElement).value).toBe('<b>"a" & \'b\'</b>');
    });

    it('sets the name attribute only when given', () => {
        const named = xnew(InputText, { name: 'title' });
        const anonymous = xnew(InputText);

        expect((named.element as HTMLInputElement).getAttribute('name')).toBe('title');
        expect((anonymous.element as HTMLInputElement).hasAttribute('name')).toBe(false);
    });

    it('delivers a string value to input listeners', () => {
        const unit = xnew(InputText);
        const input = unit.element as HTMLInputElement;

        const received: string[] = [];
        unit.on('input', ({ value }: { value: string }) => received.push(value));
        jest.advanceTimersByTime(0);
        input.value = 'abc';
        input.dispatchEvent(new Event('input', { bubbles: false }));

        expect(received).toEqual(['abc']);
    });

    it('applies className and style to the input', () => {
        const unit = xnew(InputText, { className: 'field', style: 'width: 8em;' });
        const input = unit.element as HTMLInputElement;

        expect(input.className).toContain('field');
        expect(input.getAttribute('style')).toContain('width: 8em;');
    });
});
