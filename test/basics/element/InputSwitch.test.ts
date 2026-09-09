import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';
import { InputSwitch } from '../../../src/basics/element/InputCheckbox';

describe('basics InputSwitch', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        Unit.reset();
    });
    afterEach(() => {
        Unit.engineRoot?.destroy();
        jest.useRealTimers();
    });

    // unit.current is the container (carries the framed pill); the hidden input and the knob div nest inside it
    function inputOf(unit: xnew.Unit): HTMLInputElement {
        return unit.current.querySelector('input') as HTMLInputElement;
    }

    // every value event a host would see, tagged by type, in order
    function record(unit: xnew.Unit): Array<[string, unknown]> {
        const seen: Array<[string, unknown]> = [];
        unit.on('input change', ({ event, value }: { event: Event, value: unknown }) => seen.push([event.type, value]));
        jest.advanceTimersByTime(0);
        return seen;
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
        expect(unit.current.hasAttribute('data-checked')).toBe(false);
        expect(unit.input.checked).toBe(false);
    });

    it('marks the container as checked while on', () => {
        const unit = xnew(InputSwitch, { value: true });

        expect(unit.current.hasAttribute('data-checked')).toBe(true);
        expect(unit.input.checked).toBe(true);
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
        expect(unit.current.hasAttribute('data-checked')).toBe(true);
    });

    it('applies className and style to the container element', () => {
        const unit = xnew(InputSwitch, { className: 'pill', style: 'width: 4em;' });

        expect(unit.current.className).toContain('pill');
        expect(unit.current.getAttribute('style')).toContain('width: 4em;');
    });

    it('omits the default knob when composed by the caller', () => {
        const unit = xnew(() => {
            xnew.extend(InputSwitch, { value: true });
        });

        expect(unit.current.querySelectorAll('div')).toHaveLength(0);
        expect(inputOf(unit).tagName).toBe('INPUT');
    });

    // the Gate driver is bound to the hidden input, so the setter's own event cannot re-enter it
    it('fires the native input + change pair once each on a .value set', () => {
        const unit = xnew(InputSwitch);
        const seen = record(unit);

        unit.value = true;

        expect(seen).toEqual([['input', true], ['change', true]]);
    });

    it('reads and writes the on/off state through .value', () => {
        const unit = xnew(InputSwitch);
        jest.advanceTimersByTime(0);

        expect(unit.value).toBe(false);

        unit.value = true;
        jest.advanceTimersByTime(0);
        expect(unit.value).toBe(true);
        expect(inputOf(unit).checked).toBe(true);
        expect(unit.current.hasAttribute('data-checked')).toBe(true);

        unit.value = false;
        jest.advanceTimersByTime(1);
        expect(unit.value).toBe(false);
        expect(inputOf(unit).checked).toBe(false);
        expect(unit.current.hasAttribute('data-checked')).toBe(false);
    });

    it('exposes the hidden native checkbox through .input', () => {
        const unit = xnew(InputSwitch, { value: true });

        expect(unit.input).toBe(inputOf(unit));
        expect(unit.input.checked).toBe(true);
    });
});
