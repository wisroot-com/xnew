import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';
import { InputSelect } from '../../../src/basics/element/InputSelect';

describe('basics InputSelect', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        Unit.reset();
    });
    afterEach(() => {
        Unit.engineRoot?.finalize();
        jest.useRealTimers();
    });

    function frameOf(unit: xnew.Unit): HTMLElement {
        return unit.element.parentElement as HTMLElement;
    }

    function labelOf(unit: xnew.Unit): HTMLElement {
        return frameOf(unit).querySelector('div') as HTMLElement;
    }

    function dropdownOf(unit: xnew.Unit): HTMLElement | null {
        return frameOf(unit).querySelector('select ~ *') as HTMLElement | null;
    }

    function open(unit: xnew.Unit): HTMLElement {
        jest.advanceTimersByTime(0);
        frameOf(unit).dispatchEvent(new Event('click', { bubbles: false }));
        jest.advanceTimersByTime(0);
        return dropdownOf(unit) as HTMLElement;
    }

    it('nests a hidden native select with the items and initial selection', () => {
        const unit = xnew(InputSelect, { items: ['low', 'mid', 'high'], value: 'mid', name: 'level' });
        const select = unit.element as HTMLSelectElement;

        expect(select.tagName).toBe('SELECT');
        expect(select.getAttribute('name')).toBe('level');
        expect(select.style.display).toBe('none');
        expect(Array.from(select.options).map((o) => o.value)).toEqual(['low', 'mid', 'high']);
        expect(select.value).toBe('mid');
        expect(labelOf(unit).textContent).toBe('mid');
    });

    it('defaults to the first item', () => {
        const unit = xnew(InputSelect, { items: ['low', 'mid', 'high'] });

        expect((unit.element as HTMLSelectElement).value).toBe('low');
        expect(labelOf(unit).textContent).toBe('low');
    });

    it('toggles the floating option list on click', () => {
        const unit = xnew(InputSelect, { items: ['low', 'mid', 'high'] });

        expect(dropdownOf(unit)).toBeNull();
        const dropdown = open(unit);
        expect(dropdown).not.toBeNull();
        expect(dropdown.textContent).toBe('lowmidhigh');

        frameOf(unit).dispatchEvent(new Event('click', { bubbles: false }));
        expect(dropdownOf(unit)).toBeNull();
    });

    it('selects an option: updates the label and the select, emits input, and closes', () => {
        const unit = xnew(InputSelect, { items: ['low', 'mid', 'high'] });

        const received: string[] = [];
        unit.on('input', ({ value }: { value: string }) => received.push(value));

        const dropdown = open(unit);
        const options = Array.from(dropdown.children) as HTMLElement[];
        options[2].dispatchEvent(new Event('click', { bubbles: true }));

        expect(received).toEqual(['high']);
        expect((unit.element as HTMLSelectElement).value).toBe('high');
        expect(labelOf(unit).textContent).toBe('high');
        expect(dropdownOf(unit)).toBeNull();
    });

    it('highlights the current value in the option list', () => {
        const unit = xnew(InputSelect, { items: ['low', 'mid', 'high'], value: 'mid' });

        const options = Array.from(open(unit).children) as HTMLElement[];
        // the highlight is the one extra class on the selected option
        const highlight = Array.from(options[1].classList).find((c) => !options[0].classList.contains(c)) as string;
        expect(highlight).toBeTruthy();
        expect(options.map((o) => o.classList.contains(highlight))).toEqual([false, true, false]);
    });

    it('closes the option list on a pointerdown outside the control', () => {
        const unit = xnew(InputSelect, { items: ['low', 'mid'] });

        expect(open(unit)).not.toBeNull();
        document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
        expect(dropdownOf(unit)).toBeNull();
    });

    it('keeps the option list open on a pointerdown inside the control', () => {
        const unit = xnew(InputSelect, { items: ['low', 'mid'] });

        const dropdown = open(unit);
        dropdown.children[0].dispatchEvent(new Event('pointerdown', { bubbles: true }));
        expect(dropdownOf(unit)).not.toBeNull();
    });
});
