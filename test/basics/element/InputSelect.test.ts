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

    function containerOf(unit: xnew.Unit): HTMLElement {
        return unit.element.parentElement as HTMLElement;
    }

    // the first container child is the label box: visible label first, then the hidden per-item sizers
    function labelOf(unit: xnew.Unit): HTMLElement {
        return containerOf(unit).firstElementChild?.firstElementChild as HTMLElement;
    }

    function dropdownOf(unit: xnew.Unit): HTMLElement | null {
        return containerOf(unit).querySelector('select ~ *') as HTMLElement | null;
    }

    function open(unit: xnew.Unit): HTMLElement {
        jest.advanceTimersByTime(0);
        containerOf(unit).dispatchEvent(new Event('click', { bubbles: false }));
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

    it('reserves the width of every item with hidden sizers in the button', () => {
        const unit = xnew(InputSelect, { items: ['low', 'a much longer option'] });
        const sizers = Array.from((labelOf(unit).parentElement as HTMLElement).children).slice(1) as HTMLElement[];

        expect(sizers.map((s) => s.textContent)).toEqual(['low', 'a much longer option']);
        expect(sizers.every((s) => s.style.visibility === 'hidden' && s.style.height === '0px')).toBe(true);
    });

    it('toggles the floating option list on click', () => {
        const unit = xnew(InputSelect, { items: ['low', 'mid', 'high'] });

        expect(dropdownOf(unit)).toBeNull();
        const dropdown = open(unit);
        expect(dropdown).not.toBeNull();
        expect(dropdown.textContent).toBe('lowmidhigh');
        // fixed + max-content (in the menu css rule): the list escapes overflow-clipping ancestors
        // and outgrows the button; anchored to the button's viewport rect (all zero under jsdom)
        const styleText = [...document.head.querySelectorAll('style')].map((s) => s.textContent).join('\n');
        expect(dropdown.className).toMatch(/xnew\d+-menu/);
        expect(styleText).toContain('position: fixed; margin-top: 0.25em; width: max-content;');
        expect(dropdown.style.left).toBe('0px');
        expect(dropdown.style.top).toBe('0px');
        expect(dropdown.style.minWidth).toBe('0px');

        containerOf(unit).dispatchEvent(new Event('click', { bubbles: false }));
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

    it('marks the current value with data-checked in the option list', () => {
        const unit = xnew(InputSelect, { items: ['low', 'mid', 'high'], value: 'mid' });

        const options = Array.from(open(unit).children) as HTMLElement[];
        expect(options.map((o) => o.hasAttribute('data-checked'))).toEqual([false, true, false]);
    });

    it('suppresses the button hover tint via data-open while the option list is open', () => {
        const unit = xnew(InputSelect, { items: ['low', 'mid'] });
        const styleText = [...document.head.querySelectorAll('style')].map((s) => s.textContent).join('\n');
        expect(styleText).toContain('&:not([data-open]):hover { background: color-mix(in srgb, currentColor 20%, transparent); }');

        expect(containerOf(unit).hasAttribute('data-open')).toBe(false);
        open(unit);
        expect(containerOf(unit).hasAttribute('data-open')).toBe(true);

        containerOf(unit).dispatchEvent(new Event('click', { bubbles: false }));
        expect(containerOf(unit).hasAttribute('data-open')).toBe(false);
    });

    it('applies designs to the label, menu, and item parts', () => {
        const unit = xnew(InputSelect, {
            items: ['low', 'mid'],
            designs: {
                label: { style: 'font-weight: bold;' },
                menu: { style: 'border-radius: 0.5em;' },
                item: { className: 'row' },
            },
        });

        expect(labelOf(unit).getAttribute('style')).toContain('font-weight: bold;');
        const dropdown = open(unit);
        expect(dropdown.getAttribute('style')).toContain('border-radius: 0.5em;');
        expect(Array.from(dropdown.children).every((o) => (o as HTMLElement).className.includes('row'))).toBe(true);
    });

    it('applies className and style to the container element', () => {
        const unit = xnew(InputSelect, { items: ['low'], className: 'boxed', style: 'width: 12em;' });

        expect(containerOf(unit).className).toContain('boxed');
        expect(containerOf(unit).getAttribute('style')).toContain('width: 12em;');
    });

    it('wears the surface color behind the control on the option list', () => {
        const host = document.createElement('div');
        host.style.backgroundColor = 'rgb(1, 2, 3)';
        document.body.appendChild(host);
        const unit = xnew(host, InputSelect, { items: ['low', 'mid'] });

        expect(open(unit).style.backgroundColor).toBe('rgb(1, 2, 3)');
        host.remove();
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
