import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';
import { InputRadio } from '../../../src/basics/element/InputRadio';

describe('basics InputRadio', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        Unit.reset();
    });
    afterEach(() => {
        Unit.engineRoot?.finalize();
        jest.useRealTimers();
    });

    // container > frame > item* > [label, input]; unit.element ends on the frame
    function radiosOf(unit: xnew.Unit): HTMLInputElement[] {
        return Array.from(unit.element.querySelectorAll('input')) as HTMLInputElement[];
    }

    function itemsOf(unit: xnew.Unit): HTMLElement[] {
        return Array.from(unit.element.children) as HTMLElement[];
    }

    it('renders one item cell with a hidden radio per item, sharing a group name', () => {
        const unit = xnew(InputRadio, { items: ['low', 'mid', 'high'] });
        const radios = radiosOf(unit);

        expect(radios).toHaveLength(3);
        expect(radios.map((r) => r.value)).toEqual(['low', 'mid', 'high']);
        expect(new Set(radios.map((r) => r.name)).size).toBe(1);
        expect(radios[0].name).not.toBe('');
        expect(unit.element.textContent).toBe('lowmidhigh');
    });

    it('uses the given name for the radio group', () => {
        const unit = xnew(InputRadio, { items: ['a', 'b'], name: 'level' });

        expect(radiosOf(unit).every((r) => r.name === 'level')).toBe(true);
    });

    it('checks the initial value (defaulting to the first item)', () => {
        const explicit = xnew(InputRadio, { items: ['a', 'b'], value: 'b' });
        const defaulted = xnew(InputRadio, { items: ['a', 'b'] });

        expect(radiosOf(explicit).map((r) => r.checked)).toEqual([false, true]);
        expect(radiosOf(defaulted).map((r) => r.checked)).toEqual([true, false]);
        expect(itemsOf(explicit).map((s) => s.hasAttribute('data-checked'))).toEqual([false, true]);
    });

    it('carries the selected look in a data-checked css rule', () => {
        xnew(InputRadio, { items: ['a'] });
        const styleText = [...document.head.querySelectorAll('style')].map((s) => s.textContent).join('\n');

        expect(styleText).toContain('&[data-checked] { background: color-mix(in srgb, currentColor 20%, transparent); }');
    });

    it('delivers the selected value and moves data-checked on input', () => {
        const unit = xnew(InputRadio, { items: ['low', 'mid', 'high'] });
        const radios = radiosOf(unit);

        const received: string[] = [];
        unit.on('input', ({ value }: { value: string }) => received.push(value));
        jest.advanceTimersByTime(0);

        radios[2].checked = true;
        radios[2].dispatchEvent(new Event('input', { bubbles: true }));

        expect(received).toEqual(['high']);
        expect(itemsOf(unit).map((s) => s.hasAttribute('data-checked'))).toEqual([false, false, true]);
    });

    it('applies designs to the frame and item parts', () => {
        const unit = xnew(InputRadio, { items: ['a', 'b'], designs: { frame: { className: 'pill' }, item: { style: 'font-weight: bold;' } } });

        expect(unit.element.className).toContain('pill');
        expect(itemsOf(unit).every((s) => (s.getAttribute('style') ?? '').includes('font-weight: bold;'))).toBe(true);
    });

    it('applies className and style to the container element', () => {
        const unit = xnew(InputRadio, { items: ['a'], className: 'boxed', style: 'width: 12em;' });
        const container = unit.element.parentElement as HTMLElement;

        expect(container.className).toContain('boxed');
        expect(container.getAttribute('style')).toContain('width: 12em;');
    });
});
