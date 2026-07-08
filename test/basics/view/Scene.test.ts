import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';
import { Scene } from '../../../src/basics/view/Scene';
import { SceneList } from '../../../src/basics/view/SceneList';

describe('basics Scene', () => {
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

    const scenePage = (track: (name: string) => Function, name: string) => (unit: xnew.Unit) => {
        xnew.extend(Scene);
        track(name)(unit);
    };

    // the canonical layout: the SceneList first, then the first scene, as siblings
    const makeHost = (list: any, First: (unit: xnew.Unit) => any) => {
        const holder: any = {};
        holder.host = xnew('<div>', (unit: xnew.Unit) => {
            xnew(SceneList, { list });
            holder.first = xnew(First);
        });
        return holder;
    };

    describe('change (label via a preceding sibling SceneList)', () => {
        it('resolves the label and swaps scenes as siblings', () => {
            const { log, track } = lifecycle();
            const received: any[] = [];
            const B = (unit: xnew.Unit, props: any) => { received.push(props); track('B')(unit); };
            const { host, first } = makeHost({ b: [B, { tag: 'b' }] }, scenePage(track, 'A'));

            first.change('b');

            expect(log).toEqual(['A:in', 'B:in', 'A:out']);
            expect(received).toEqual([{ tag: 'b' }]);
            expect(host.element.children.length).toBe(0); // scenes share the host element (no nest)
        });

        it('a swapped-in scene can also change by label (context persists in the scope)', () => {
            const { log, track } = lifecycle();
            const holder: any = {};
            const B = (unit: xnew.Unit) => { xnew.extend(Scene); track('B')(unit); holder.b = unit; };
            const { first } = makeHost({ a: [scenePage(track, 'A2')], b: [B] }, scenePage(track, 'A'));

            first.change('b');
            holder.b.change('a');

            expect(log).toEqual(['A:in', 'B:in', 'A:out', 'A2:in', 'B:out']);
        });

        it('ignores unknown labels', () => {
            const { log, track } = lifecycle();
            const { first } = makeHost({}, scenePage(track, 'A'));

            first.change('nowhere');

            expect(log).toEqual(['A:in']);
        });

        it('is a no-op without a SceneList', () => {
            const { log, track } = lifecycle();
            const scene = xnew(scenePage(track, 'A'));

            scene.change('anywhere');

            expect(log).toEqual(['A:in']);
        });
    });

    describe('change (Component form)', () => {
        it('swaps scenes as siblings with runtime props', () => {
            const { log, track } = lifecycle();
            const host = xnew('<div>');
            const first = xnew(host, scenePage(track, 'A'));
            const received: any[] = [];
            const Next = (unit: xnew.Unit, props: any) => { received.push(props); track('B')(unit); };

            first.change(Next, { score: 42 });

            expect(log).toEqual(['A:in', 'B:in', 'A:out']);
            expect(received).toEqual([{ score: 42 }]);
        });
    });

    describe('leave protocol (out-in) and re-entry guard', () => {
        const leavingScene = (log: string[], name: string, wait: () => any) => (unit: xnew.Unit) => {
            xnew.extend(Scene);
            log.push(`${name}:in`);
            unit.on('finalize', () => log.push(`${name}:out`));
            return { leave() { log.push(`${name}:leave`); return wait(); } };
        };

        it('waits for the leave timer before swapping (label form)', () => {
            const { log, track } = lifecycle();
            const values: number[] = [];
            const A = leavingScene(log, 'A', () => xnew.transition(({ value }: any) => values.push(value), 300));
            const { first } = makeHost({ b: [track('B')] }, A);

            first.change('b');
            expect(log).toEqual(['A:in', 'A:leave']); // A still alive, B not mounted

            jest.advanceTimersByTime(301);
            expect(log).toEqual(['A:in', 'A:leave', 'B:in', 'A:out']);
            expect(values[values.length - 1]).toBe(1); // leave transition ran to completion
        });

        it('applies the leave protocol to the Component form too', () => {
            const { log, track } = lifecycle();
            const host = xnew('<div>');
            const first = xnew(host, leavingScene(log, 'A', () => xnew.transition(() => {}, 200)));

            first.change(track('B'));
            expect(log).toEqual(['A:in', 'A:leave']);

            jest.advanceTimersByTime(201);
            expect(log).toEqual(['A:in', 'A:leave', 'B:in', 'A:out']);
        });

        it('ignores further change calls while a leave is pending', () => {
            const { log, track } = lifecycle();
            const A = leavingScene(log, 'A', () => xnew.transition(() => {}, 200));
            const { first } = makeHost({ b: [track('B')], c: [track('C')] }, A);

            first.change('b');
            first.change('c'); // during leave → ignored

            jest.advanceTimersByTime(201);
            expect(log).toEqual(['A:in', 'A:leave', 'B:in', 'A:out']);
        });

        it('swaps immediately when leave() returns nothing', () => {
            const { log, track } = lifecycle();
            const A = leavingScene(log, 'A', () => undefined);
            const { first } = makeHost({ b: [track('B')] }, A);

            first.change('b');

            expect(log).toEqual(['A:in', 'A:leave', 'B:in', 'A:out']);
        });
    });

    describe('add', () => {
        it('mounts a child under the scene unit, finalized together on a swap', () => {
            const { log, track } = lifecycle();
            const { first } = makeHost({ b: [track('B')] }, scenePage(track, 'A'));

            const child = first.add(track('child'));
            expect(child.parent).toBe(first);

            first.change('b');
            expect(log).toEqual(['A:in', 'child:in', 'B:in', 'child:out', 'A:out']);
        });
    });
});
