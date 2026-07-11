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

    // container > frame > [knob, input]
    function frameOf(unit: xnew.Unit): HTMLElement {
        return unit.element.parentElement as HTMLElement;
    }

    function knobOf(unit: xnew.Unit): HTMLElement {
        return frameOf(unit).querySelector('div') as HTMLElement;
    }

    it('nests a hidden native checkbox with the given state', () => {
        const unit = xnew(InputSwitch, { value: true, name: 'sound' });
        const input = unit.element as HTMLInputElement;

        expect(input.tagName).toBe('INPUT');
        expect(input.getAttribute('type')).toBe('checkbox');
        expect(input.checked).toBe(true);
        expect(input.getAttribute('name')).toBe('sound');
    });

    it('defaults to off', () => {
        const unit = xnew(InputSwitch);

        expect((unit.element as HTMLInputElement).checked).toBe(false);
        expect(frameOf(unit).hasAttribute('data-checked')).toBe(false);
    });

    it('marks the frame as checked while on', () => {
        const unit = xnew(InputSwitch, { value: true });

        expect(frameOf(unit).hasAttribute('data-checked')).toBe(true);
    });

    it('carries the on look in data-checked css rules (tint + knob slide)', () => {
        xnew(InputSwitch);
        const styleText = [...document.head.querySelectorAll('style')].map((s) => s.textContent).join('\n');

        expect(styleText).toContain('&[data-checked] { background: color-mix(in srgb, currentColor 20%, transparent); }');
        expect(styleText).toContain('[data-checked] > & { left: calc(100% - 0.15em); transform: translateX(-100%); }');
    });

    it('toggles data-checked and delivers a boolean value on input', () => {
        const unit = xnew(InputSwitch);
        const input = unit.element as HTMLInputElement;

        const received: boolean[] = [];
        unit.on('input', ({ value }: { value: boolean }) => received.push(value));
        jest.advanceTimersByTime(0);
        input.checked = true;
        input.dispatchEvent(new Event('input', { bubbles: false }));

        expect(received).toEqual([true]);
        expect(frameOf(unit).hasAttribute('data-checked')).toBe(true);
    });

    it('applies designs to the frame and knob parts', () => {
        const unit = xnew(InputSwitch, { designs: { frame: { className: 'pill' }, knob: { style: 'background: gold;' } } });

        expect(frameOf(unit).className).toContain('pill');
        expect(knobOf(unit).getAttribute('style')).toContain('background: gold;');
    });

    it('applies className and style to the container (exposed via the getter)', () => {
        const unit = xnew(InputSwitch, { className: 'boxed', style: 'width: 3em;' });

        expect(unit.container).toBe(frameOf(unit).parentElement);
        expect(unit.container.className).toContain('boxed');
        expect(unit.container.getAttribute('style')).toContain('width: 3em;');
    });
});
