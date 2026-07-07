import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';
import { Stage } from '../../../src/basics/view/Stage';

describe('basics Stage', () => {
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

    const makeStage = (track: (name: string) => Function, options: any = {}) => xnew(Stage, {
        pages: {
            intro: [track('intro')],
            story: [[track('s0')], [track('s1')], [track('s2')]],
            good: [track('good')],
            bad: [track('bad')],
        },
        ...options,
    });

    describe('change (label addressing)', () => {
        it('mounts the first defined page on creation', () => {
            const { log, track } = lifecycle();
            const stage = makeStage(track);

            expect(log).toEqual(['intro:in']);
            expect(stage.page).toEqual(expect.objectContaining({ label: 'intro', index: null }));
            expect(stage.page?.unit).toBeInstanceOf(Unit);
        });

        it('change(label) finalizes the current page and mounts the labeled one', () => {
            const { log, track } = lifecycle();
            const stage = makeStage(track);

            stage.change('bad');

            expect(log).toEqual(['intro:in', 'intro:out', 'bad:in']);
            expect(stage.page).toEqual(expect.objectContaining({ label: 'bad', index: null }));
        });

        it('change(arrayLabel) mounts the first element with index 0', () => {
            const { track } = lifecycle();
            const stage = makeStage(track);

            stage.change('story');

            expect(stage.page).toEqual(expect.objectContaining({ label: 'story', index: 0 }));
        });

        it('change(arrayLabel, i) mounts the i-th element', () => {
            const { track } = lifecycle();
            const stage = makeStage(track);

            stage.change('story', 2);

            expect(stage.page).toEqual(expect.objectContaining({ label: 'story', index: 2 }));
        });

        it('ignores unknown labels and out-of-range indices', () => {
            const { log, track } = lifecycle();
            const stage = makeStage(track);

            stage.change('nowhere');
            stage.change('story', 9);
            stage.change('story', -1);

            expect(stage.page?.label).toBe('intro');
            expect(log).toEqual(['intro:in']);
        });

        it('ignores a change to the current page', () => {
            const { log, track } = lifecycle();
            const stage = makeStage(track);
            const changed = jest.fn();
            stage.on('-pagechange', changed);

            stage.change('intro');
            stage.change('story', 1);
            stage.change('story', 1);

            expect(changed).toHaveBeenCalledTimes(1);
            expect(log).toEqual(['intro:in', 'intro:out', 's1:in']);
        });

        it('emits -pagechange with label/index and fromLabel/fromIndex', () => {
            const { track } = lifecycle();
            const stage = makeStage(track);
            const changed = jest.fn();
            stage.on('-pagechange', changed);

            stage.change('story', 1);
            expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({
                label: 'story', index: 1, fromLabel: 'intro', fromIndex: null,
            }));

            stage.change('good');
            expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({
                label: 'good', index: null, fromLabel: 'story', fromIndex: 1,
            }));
        });

        it('passes props of a [Component, props] page, standalone or inside an array', () => {
            const received: any[] = [];
            const P = (_unit: xnew.Unit, props: any) => { received.push(props); };
            const stage = xnew(Stage, {
                pages: {
                    single: [P, { tag: 'single' }],
                    list: [[P, { tag: 'l0' }], [P]], // elements always in [Component, props] form
                },
            });

            expect(stage.page).toEqual(expect.objectContaining({ label: 'single', index: null }));
            stage.change('list');
            expect(stage.page).toEqual(expect.objectContaining({ label: 'list', index: 0 }));
            expect(received).toEqual([{ tag: 'single' }, { tag: 'l0' }]);
        });

        it('finalizes the current page together with the Stage unit', () => {
            const { log, track } = lifecycle();
            const stage = xnew(Stage, { pages: { only: [track('A')] } });

            stage.finalize();

            expect(log).toEqual(['A:in', 'A:out']);
        });

        it('page is null when the stage has no pages', () => {
            const stage = xnew(Stage);
            expect(stage.page).toBeNull();
        });
    });

    describe('next / prev (within the current array)', () => {
        it('moves forward and backward inside the array, keeping the label', () => {
            const { track } = lifecycle();
            const stage = makeStage(track);
            stage.change('story');

            stage.next();
            expect(stage.page).toEqual(expect.objectContaining({ label: 'story', index: 1 }));
            stage.prev();
            expect(stage.page).toEqual(expect.objectContaining({ label: 'story', index: 0 }));
        });

        it('does not move at the ends of the array', () => {
            const { track } = lifecycle();
            const stage = makeStage(track);

            stage.change('story');
            stage.prev();
            expect(stage.page?.index).toBe(0);

            stage.change('story', 2);
            stage.next();
            expect(stage.page?.index).toBe(2);
        });

        it('does nothing when the current page is not an array element (index null)', () => {
            const { log, track } = lifecycle();
            const stage = makeStage(track);

            stage.next();
            stage.prev();

            expect(stage.page).toEqual(expect.objectContaining({ label: 'intro', index: null }));
            expect(log).toEqual(['intro:in']);
        });
    });

    describe('leave protocol (out-in)', () => {
        const leavingPage = (log: string[], name: string, wait: () => any) => (unit: xnew.Unit) => {
            log.push(`${name}:in`);
            unit.on('finalize', () => log.push(`${name}:out`));
            return { leave() { log.push(`${name}:leave`); return wait(); } };
        };

        // annotated: built outside the xnew call, so [fn] needs the tuple type stated explicitly
        const pagesWithLeave = (log: string[], track: (name: string) => Function, wait: () => any):
            { pages: { [label: string]: [Function] } } => ({
            pages: { a: [leavingPage(log, 'A', wait)], b: [track('B')], c: [track('C')] },
        });

        it('waits for a returned UnitTimer (xnew.transition) before finalizing the old page', () => {
            const { log, track } = lifecycle();
            const values: number[] = [];
            const stage = xnew(Stage, pagesWithLeave(log, track, () => xnew.transition(({ value }: any) => values.push(value), 300)));

            stage.change('b');
            expect(log).toEqual(['A:in', 'A:leave']); // old page still alive, B not mounted
            expect(stage.page?.label).toBe('a');       // current page is still A

            jest.advanceTimersByTime(301);
            expect(log).toEqual(['A:in', 'A:leave', 'A:out', 'B:in']);
            expect(values[values.length - 1]).toBe(1); // leave transition ran to completion
            expect(stage.page?.label).toBe('b');
        });

        it('swaps immediately when leave() returns nothing', () => {
            const { log, track } = lifecycle();
            const stage = xnew(Stage, pagesWithLeave(log, track, () => undefined));

            stage.change('b');
            expect(log).toEqual(['A:in', 'A:leave', 'A:out', 'B:in']);
        });

    });
});
