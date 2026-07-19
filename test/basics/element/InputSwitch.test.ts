import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';
import { InputSwitch } from '../../../src/basics/element/InputSwitch';

describe('basics InputSwitch', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        Unit.reset();
    });
    afterEach(() => {
        Unit.engineRoot?.finalize();
        jest.useRealTimers();
    });

    // unit.element is the container (carries the framed pill); the hidden input and the knob div nest inside it
    function inputOf(unit: xnew.Unit): HTMLInputElement {
        return unit.element.querySelector('input') as HTMLInputElement;
    }

    function knobOf(unit: xnew.Unit): HTMLElement {
        return unit.element.querySelectorAll('div')[0] as HTMLElement;
    }

    it('nests a hidden native checkbox with the given state', () => {
        const unit = xnew(InputSwitch, { value: true, name: 'sound' });
        const input = inputOf(unit);

        expect(input.tagName).toBe('INPUT');
        expect(input.getAttribute('type')).toBe('checkbox');
        expect(input.checked).toBe(true);
        expect(input.getAttribute('name')).toBe('sound');
    });

    it('defaults to off', () => {
        const unit = xnew(InputSwitch);

        expect(inputOf(unit).checked).toBe(false);
        expect(unit.element.hasAttribute('data-checked')).toBe(false);
        expect(unit.value).toBe(false);
    });

    it('marks the container as checked while on', () => {
        const unit = xnew(InputSwitch, { value: true });

        expect(unit.element.hasAttribute('data-checked')).toBe(true);
        expect(unit.value).toBe(true);
    });

    it('carries the on look in data-checked css rules (tint + knob slide)', () => {
        xnew(InputSwitch);
        const styleText = [...document.head.querySelectorAll('style')].map((s) => s.textContent).join('\n');

        expect(styleText).toContain('&[data-checked] { background: color-mix(in srgb, currentColor 20%, transparent); }');
        expect(styleText).toContain('[data-checked] > & { left: calc(100% - 0.15em); transform: translateX(-100%); }');
    });

    it('toggles data-checked and delivers a boolean value on input', () => {
        const unit = xnew(InputSwitch);
        const input = inputOf(unit);

        const received: boolean[] = [];
        unit.on('input', ({ value }: { value: boolean }) => received.push(value));
        jest.advanceTimersByTime(0);
        input.checked = true;
        input.dispatchEvent(new Event('input', { bubbles: true }));

        expect(received).toEqual([true]);
        expect(unit.element.hasAttribute('data-checked')).toBe(true);
    });

    it('applies attributes to the knob part', () => {
        const unit = xnew(InputSwitch, { attributes: { knob: { className: 'dot', style: 'background: gold;' } } });

        expect(knobOf(unit).className).toContain('dot');
        expect(knobOf(unit).getAttribute('style')).toContain('background: gold;');
    });

    it('applies className and style to the container element', () => {
        const unit = xnew(InputSwitch, { className: 'pill', style: 'width: 4em;' });

        expect(unit.element.className).toContain('pill');
        expect(unit.element.getAttribute('style')).toContain('width: 4em;');
    });
});
