import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';
import { Pages } from '../../../src/basics/view/Pages';

describe('basics Pages', () => {
    beforeEach(() => { jest.useFakeTimers({ now: 0 }); Unit.reset(); });
    afterEach(() => { Unit.engineRoot?.finalize(); jest.useRealTimers(); });

    const lifecycle = () => {
        const log: string[] = [];
        const track = (name: string) => (unit: xnew.Unit) => {
            log.push(`${name}:in`);
            unit.on('finalize', () => log.push(`${name}:out`));
        };
        return { log, track };
    };

    it('mounts the first page on creation', () => {
        const { log, track } = lifecycle();
        const pages = xnew(Pages, { pages: [track('A'), track('B')] });

        expect(log).toEqual(['A:in']);
        expect(pages.index).toBe(0);
        expect(pages.length).toBe(2);
    });

    it('next() finalizes the current page, mounts the next, and emits -pagechange', () => {
        const { log, track } = lifecycle();
        const pages = xnew(Pages, { pages: [track('A'), track('B')] });
        const changed = jest.fn();
        pages.on('-pagechange', changed);

        pages.next();

        expect(log).toEqual(['A:in', 'A:out', 'B:in']);
        expect(pages.index).toBe(1);
        expect(changed).toHaveBeenCalledWith(expect.objectContaining({ index: 1, from: 0 }));
    });

    it('next() on the last page emits -complete and stays', () => {
        const { track } = lifecycle();
        const pages = xnew(Pages, { pages: [track('A'), track('B')] });
        const completed = jest.fn();
        pages.on('-complete', completed);

        pages.next();
        pages.next();

        expect(pages.index).toBe(1);
        expect(completed).toHaveBeenCalledWith(expect.objectContaining({ index: 1 }));
    });

    it('wraps around at both ends when loop is true', () => {
        const { track } = lifecycle();
        const pages = xnew(Pages, { pages: [track('A'), track('B')], loop: true });

        pages.prev();
        expect(pages.index).toBe(1);
        pages.next();
        expect(pages.index).toBe(0);
    });

    it('prev() at the first page is ignored when loop is false', () => {
        const { log, track } = lifecycle();
        const pages = xnew(Pages, { pages: [track('A'), track('B')] });

        pages.prev();

        expect(pages.index).toBe(0);
        expect(log).toEqual(['A:in']);
    });

    it('go() jumps to a valid index and ignores out-of-range values', () => {
        const { track } = lifecycle();
        const pages = xnew(Pages, { pages: [track('A'), track('B'), track('C')] });

        pages.go(2);
        expect(pages.index).toBe(2);
        pages.go(3);
        expect(pages.index).toBe(2);
        pages.go(-1);
        expect(pages.index).toBe(2);
    });

    it('ignores navigation during the cooldown window', () => {
        const { track } = lifecycle();
        const pages = xnew(Pages, { pages: [track('A'), track('B'), track('C')], cooldown: 300 });

        pages.next();
        pages.next(); // within cooldown → ignored
        expect(pages.index).toBe(1);

        jest.advanceTimersByTime(300);
        pages.next();
        expect(pages.index).toBe(2);
    });

    it('passes props to a [Component, props] entry', () => {
        const received: any[] = [];
        const PageA = (_unit: xnew.Unit, props: any) => { received.push(props); };
        xnew(Pages, { pages: [[PageA, { text: 'hello' }]] });

        expect(received).toEqual([{ text: 'hello' }]);
    });

    it('finalizes the current page together with the Pages unit', () => {
        const { log, track } = lifecycle();
        const pages = xnew(Pages, { pages: [track('A')] });

        pages.finalize();

        expect(log).toEqual(['A:in', 'A:out']);
    });
});
