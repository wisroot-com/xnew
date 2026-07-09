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

    function trackOf(unit: xnew.Unit): HTMLElement {
        return unit.element.parentElement as HTMLElement;
    }

    function knobOf(unit: xnew.Unit): HTMLElement {
        return trackOf(unit).querySelector('div') as HTMLElement;
    }

    it('nests a hidden native checkbox with the given state', () => {
        const unit = xnew(InputSwitch, { value: true, name: 'sound' });
        const input = unit.element as HTMLInputElement;

        expect(input.tagName).toBe('INPUT');
        expect(input.getAttribute('type')).toBe('checkbox');
        expect(input.hasAttribute('checked')).toBe(true);
        expect(input.getAttribute('name')).toBe('sound');
    });

    it('parks the knob on the left while off', () => {
        const unit = xnew(InputSwitch);

        expect(knobOf(unit).style.left).toBe('0.15em');
        expect(knobOf(unit).style.transform).toBe('translateX(0)');
    });

    it('parks the knob on the right while on', () => {
        const unit = xnew(InputSwitch, { value: true });

        expect(knobOf(unit).style.left).toBe('calc(100% - 0.15em)');
        expect(knobOf(unit).style.transform).toBe('translateX(-100%)');
    });

    it('slides the knob and delivers a boolean value on input', () => {
        const unit = xnew(InputSwitch);
        const input = unit.element as HTMLInputElement;

        const received: boolean[] = [];
        unit.on('input', ({ value }: { value: boolean }) => received.push(value));
        jest.advanceTimersByTime(0);
        input.checked = true;
        input.dispatchEvent(new Event('input', { bubbles: false }));

        expect(received).toEqual([true]);
        expect(knobOf(unit).style.left).toBe('calc(100% - 0.15em)');
    });
});
