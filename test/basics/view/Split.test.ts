import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';
import { Split } from '../../../src/basics/view/Split';

describe('basics Split', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        Unit.reset();
    });
    afterEach(() => {
        Unit.engineRoot?.finalize();
        jest.useRealTimers();
    });

    it('nests a flex root and appends one pane per pane() call', () => {
        const split = xnew(Split, { direction: 'row' });
        const root = split.element as HTMLElement;
        const left = split.pane({ size: 80 });
        const right = split.pane({ size: 20 });

        expect(root.style.display).toBe('flex');
        expect(root.style.flexDirection).toBe('row');
        expect(left.element.parentElement).toBe(root);
        expect(right.element.parentElement).toBe(root);
    });

    it('defaults to a column split', () => {
        const split = xnew(Split);

        expect((split.element as HTMLElement).style.flexDirection).toBe('column');
    });

    it('maps number sizes to flexible ratios and string sizes to fixed sizes', () => {
        const split = xnew(Split);

        expect(split.pane({ size: 80 }).element.getAttribute('style')).toContain('flex: 80 1 0');
        expect(split.pane({ size: '13cqh' }).element.getAttribute('style')).toContain('flex: 0 0 13cqh');
    });

    it('makes a pane with direction its own Split so sub-panes attach right away', () => {
        const split = xnew(Split, { direction: 'column' });
        const main = split.pane({ size: 1, direction: 'row' });
        const sub = main.pane({ size: 25 });

        expect((main.element as HTMLElement).style.display).toBe('flex');
        expect((main.element as HTMLElement).style.flexDirection).toBe('row');
        expect(main.element.parentElement?.getAttribute('style')).toContain('flex: 1 1 0');
        expect(sub.element.parentElement).toBe(main.element);
    });

    it('gives a pane without direction no pane()', () => {
        const split = xnew(Split);

        expect(split.pane({ size: 1 }).pane).toBeUndefined();
    });

    it('lets a component on a directed pane add sub-panes from its own unit', () => {
        const split = xnew(Split);
        const main = split.pane({ size: 1, direction: 'row' }, (pane: xnew.Unit) => {
            pane.pane({ size: 30 }, () => { xnew('<span>', 'left'); });
            pane.pane({ size: 70 }, () => { xnew('<span>', 'right'); });
        });

        const texts = Array.from(main.element.querySelectorAll('span')).map((el) => el.textContent);
        expect(texts).toEqual(['left', 'right']);
    });

    it('mounts an optional component inside the pane', () => {
        xnew((unit: xnew.Unit) => {
            xnew.extend(Split, { direction: 'column' });
            const pane = unit.pane({ size: '3rem' }, () => {
                xnew('<span>', 'hello');
            });

            expect(pane.element.querySelector('span')?.textContent).toBe('hello');
        });
    });

    it('exposes panes as child units that host children and DOM events', () => {
        const split = xnew(Split);
        const left = split.pane({ size: 50 });
        const right = split.pane({ size: 50 });

        const child = xnew(left, '<span>', 'hello');
        expect(left.element.contains(child.element)).toBe(true);

        const clicked = jest.fn();
        right.on('click', clicked);
        jest.runOnlyPendingTimers(); // DOM listener registration is deferred by one tick
        right.element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(clicked).toHaveBeenCalledTimes(1);
    });

    it('finalizes panes together with the split', () => {
        const split = xnew(Split);
        const pane = split.pane({ size: 1 });
        const finalized = jest.fn();
        pane.on('finalize', finalized);

        split.finalize();

        expect(finalized).toHaveBeenCalledTimes(1);
    });
});
