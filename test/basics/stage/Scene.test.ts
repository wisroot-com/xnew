import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';
import { Scene } from '../../../src/basics/stage/Scene';

describe('basics Scene', () => {
    beforeEach(() => { jest.useFakeTimers({ now: 0 }); Unit.reset(); });
    afterEach(() => { Unit.engineRoot?.destroy(); jest.useRealTimers(); });

    const lifecycle = () => {
        const log: string[] = [];
        const track = (name: string) => (unit: xnew.Unit) => {
            log.push(`${name}:in`);
            unit.on('destroy', () => log.push(`${name}:out`));
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
            expect(host.current.children.length).toBe(0); // scenes share the host element (no nest)
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

    describe('exit transitions belong to the caller', () => {
        it('swaps only when the caller transition finishes, and ignores a leave() define', () => {
            const { log, track } = lifecycle();
            const values: number[] = [];
            const host = xnew('<div>');
            const first = xnew(host, (unit: xnew.Unit) => {
                xnew.extend(Scene);
                track('A')(unit);
                return { leave() { log.push('A:leave'); } }; // no longer part of the protocol
            });

            xnew.transition(({ value }: any) => values.push(value), 300).timeout(() => first.change(track('B')));
            expect(log).toEqual(['A:in']); // A still alive, B not mounted

            jest.advanceTimersByTime(301);
            expect(log).toEqual(['A:in', 'B:in', 'A:out']);
            expect(values[values.length - 1]).toBe(1); // the caller's transition ran to completion
        });
    });

    describe('add', () => {
        it('mounts a child under the scene unit, destroyed together on a swap', () => {
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
