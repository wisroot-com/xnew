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

    function radiosOf(unit: xnew.Unit): HTMLInputElement[] {
        return Array.from(unit.element.querySelectorAll('input')) as HTMLInputElement[];
    }

    it('renders one segment with a hidden radio per item, sharing a group name', () => {
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

        expect(radiosOf(explicit).map((r) => r.hasAttribute('checked'))).toEqual([false, true]);
        expect(radiosOf(defaulted).map((r) => r.hasAttribute('checked'))).toEqual([true, false]);
    });

    it('delivers the selected value and moves the highlight on input', () => {
        const unit = xnew(InputRadio, { items: ['low', 'mid', 'high'] });
        const radios = radiosOf(unit);
        const segments = Array.from(unit.element.children) as HTMLElement[];
        // the highlight is the one extra class on the selected segment ('low' initially)
        const highlight = Array.from(segments[0].classList).find((c) => !segments[1].classList.contains(c)) as string;
        expect(highlight).toBeTruthy();

        const received: string[] = [];
        unit.on('input', ({ value }: { value: string }) => received.push(value));
        jest.advanceTimersByTime(0);

        radios[2].checked = true;
        radios[2].dispatchEvent(new Event('input', { bubbles: true }));

        expect(received).toEqual(['high']);
        expect(segments.map((s) => s.classList.contains(highlight))).toEqual([false, false, true]);
    });
});
