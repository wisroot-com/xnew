import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';
import { Stage } from '../../../src/basics/view/Stage';
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

    it('unit.change delegates to the ancestor Stage', () => {
        const { log, track } = lifecycle();
        const stage = xnew(Stage, {
            scenes: { a: [scenePage(track, 'A')], b: [[track('b0')], [track('b1')]] },
        });

        stage.scene?.unit.change('b', 1);

        expect(log).toEqual(['A:in', 'A:out', 'b1:in']);
        expect(stage.scene).toEqual(expect.objectContaining({ label: 'b', index: 1 }));
    });

    it('unit.change is a no-op without an ancestor Stage', () => {
        const { log, track } = lifecycle();
        const scene = xnew(scenePage(track, 'A'));

        scene.change('anywhere');

        expect(log).toEqual(['A:in']);
    });

    it('unit.change(Component, props) swaps scenes as siblings outside a Stage', () => {
        const { log, track } = lifecycle();
        const host = xnew('<div>');
        const first = xnew(host, scenePage(track, 'A'));
        const received: any[] = [];
        const Next = (unit: xnew.Unit, props: any) => { received.push(props); track('B')(unit); };

        first.change(Next, { score: 42 });

        expect(log).toEqual(['A:in', 'B:in', 'A:out']);
        expect(received).toEqual([{ score: 42 }]);
    });

    it('add() mounts a child under the scene unit, finalized together on a page swap', () => {
        const { log, track } = lifecycle();
        const stage = xnew(Stage, {
            scenes: { a: [scenePage(track, 'A')], b: [track('B')] },
        });
        const scene = stage.scene!.unit;

        const child = scene.add(track('child'));
        expect(child.parent).toBe(scene);

        scene.change('b');
        expect(log).toEqual(['A:in', 'child:in', 'child:out', 'A:out', 'B:in']);
    });
});
