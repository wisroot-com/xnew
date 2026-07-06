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

    it('nests a flex root and creates one pane per ratio entry', () => {
        const split = xnew(Split, { direction: 'row', ratio: [80, 20], className: 'layout' });
        const root = split.element as HTMLElement;

        expect(root.style.display).toBe('flex');
        expect(root.style.flexDirection).toBe('row');
        expect(root.className).toBe('layout');
        expect(split.panes.length).toBe(2);
        expect(split.panes.every((pane: xnew.Unit) => pane.element.parentElement === root)).toBe(true);
    });

    it('defaults to a column split into two equal panes', () => {
        const split = xnew(Split);

        expect((split.element as HTMLElement).style.flexDirection).toBe('column');
        expect(split.panes.length).toBe(2);
        expect(split.panes[0].element.getAttribute('style')).toContain('flex: 1 1 0');
    });

    it('maps number entries to flexible ratios and string entries to fixed sizes', () => {
        const split = xnew(Split, { ratio: [80, '13cqh'] });

        expect(split.panes[0].element.getAttribute('style')).toContain('flex: 80 1 0');
        expect(split.panes[1].element.getAttribute('style')).toContain('flex: 0 0 13cqh');
    });

    it('exposes panes as child units that host children and DOM events', () => {
        const split = xnew(Split, { ratio: [50, 50] });
        const [left, right] = split.panes;

        const child = xnew(left, '<span>', 'hello');
        expect(left.element.contains(child.element)).toBe(true);

        const clicked = jest.fn();
        right.on('click', clicked);
        jest.runOnlyPendingTimers(); // DOM listener registration is deferred by one tick
        right.element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(clicked).toHaveBeenCalledTimes(1);
    });

    it('finalizes panes together with the split', () => {
        const split = xnew(Split, { ratio: [1, 1] });
        const [pane] = split.panes;
        const finalized = jest.fn();
        pane.on('finalize', finalized);

        split.finalize();

        expect(finalized).toHaveBeenCalledTimes(1);
    });
});
