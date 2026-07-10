import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';
import { Button } from '../../../src/basics/element/Button';

describe('basics Button', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        Unit.reset();
    });
    afterEach(() => {
        Unit.engineRoot?.finalize();
        jest.useRealTimers();
    });

    it('nests a native button with the given label', () => {
        const unit = xnew(Button, { textContent: 'start' });
        const button = unit.element as HTMLButtonElement;

        expect(button.tagName).toBe('BUTTON');
        expect(button.type).toBe('button');
        expect(button.textContent).toBe('start');
    });

    it('keeps arbitrary text intact (label is set as text, not markup)', () => {
        const unit = xnew(Button, { textContent: '<b>"a" & \'b\'</b>' });

        expect(unit.element.textContent).toBe('<b>"a" & \'b\'</b>');
        expect(unit.element.children.length).toBe(0);
    });

    it('delivers click events to listeners', () => {
        const unit = xnew(Button, { textContent: 'go' });

        let clicked = 0;
        unit.on('click', () => clicked++);
        jest.advanceTimersByTime(0);
        unit.element.dispatchEvent(new MouseEvent('click', { bubbles: false }));

        expect(clicked).toBe(1);
    });

    it('applies className and style to the button', () => {
        const unit = xnew(Button, { className: 'action', style: 'width: 8em;' });
        const button = unit.element as HTMLButtonElement;

        expect(button.className).toContain('action');
        expect(button.getAttribute('style')).toContain('width: 8em;');
    });
});
