import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';
import { Scene } from '../../../src/basics/view/Scene';

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

    describe('change', () => {
        it('swaps scenes as siblings under the shared parent, with runtime props', () => {
            const { log, track } = lifecycle();
            const host = xnew('<div>');
            const first = xnew(host, scenePage(track, 'A'));
            const received: any[] = [];
            const Next = (unit: xnew.Unit, props: any) => { received.push(props); track('B')(unit); };

            first.change(Next, { score: 42 });

            expect(log).toEqual(['A:in', 'B:in', 'A:out']);
            expect(received).toEqual([{ score: 42 }]);
            expect(host.element.children.length).toBe(0); // scenes share the host element (no nest)
        });

        it('a swapped-in scene can itself navigate onward', () => {
            const { log, track } = lifecycle();
            const host = xnew('<div>');
            const first = xnew(host, scenePage(track, 'A'));
            const holder: any = {};
            const B = (unit: xnew.Unit) => { xnew.extend(Scene); track('B')(unit); holder.b = unit; };

            first.change(B);
            holder.b.change(scenePage(track, 'A2'));

            expect(log).toEqual(['A:in', 'B:in', 'A:out', 'A2:in', 'B:out']);
        });
    });

    describe('leave protocol (out-in) and re-entry guard', () => {
        const leavingScene = (log: string[], name: string, wait: () => any) => (unit: xnew.Unit) => {
            xnew.extend(Scene);
            log.push(`${name}:in`);
            unit.on('finalize', () => log.push(`${name}:out`));
            return { leave() { log.push(`${name}:leave`); return wait(); } };
        };

        it('waits for the leave timer before swapping', () => {
            const { log, track } = lifecycle();
            const values: number[] = [];
            const host = xnew('<div>');
            const first = xnew(host, leavingScene(log, 'A', () => xnew.transition(({ value }: any) => values.push(value), 300)));

            first.change(track('B'));
            expect(log).toEqual(['A:in', 'A:leave']); // A still alive, B not mounted

            jest.advanceTimersByTime(301);
            expect(log).toEqual(['A:in', 'A:leave', 'B:in', 'A:out']);
            expect(values[values.length - 1]).toBe(1); // leave transition ran to completion
        });

        it('ignores further change calls while a leave is pending', () => {
            const { log, track } = lifecycle();
            const host = xnew('<div>');
            const first = xnew(host, leavingScene(log, 'A', () => xnew.transition(() => {}, 200)));

            first.change(track('B'));
            first.change(track('C')); // during leave → ignored

            jest.advanceTimersByTime(201);
            expect(log).toEqual(['A:in', 'A:leave', 'B:in', 'A:out']);
        });

        it('swaps immediately when leave() returns nothing', () => {
            const { log, track } = lifecycle();
            const host = xnew('<div>');
            const first = xnew(host, leavingScene(log, 'A', () => undefined));

            first.change(track('B'));

            expect(log).toEqual(['A:in', 'A:leave', 'B:in', 'A:out']);
        });
    });

    describe('add', () => {
        it('mounts a child under the scene unit, finalized together on a swap', () => {
            const { log, track } = lifecycle();
            const host = xnew('<div>');
            const first = xnew(host, scenePage(track, 'A'));

            const child = first.add(track('child'));
            expect(child.parent).toBe(first);

            first.change(track('B'));
            expect(log).toEqual(['A:in', 'child:in', 'B:in', 'child:out', 'A:out']);
        });
    });
});
