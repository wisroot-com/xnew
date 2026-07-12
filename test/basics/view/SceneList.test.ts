import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';
import { SceneList } from '../../../src/basics/view/SceneList';

describe('basics SceneList', () => {
    beforeEach(() => { jest.useFakeTimers({ now: 0 }); Unit.reset(); });
    afterEach(() => { Unit.engineRoot?.finalize(); jest.useRealTimers(); });

    it('resolve(label) returns the [Component, props] entry', () => {
        const A = () => {};
        const B = () => {};
        const list = xnew(SceneList, { list: { a: [A], b: [B, { tag: 'b' }] } });

        expect(list.resolve('a')).toEqual([A]);
        expect(list.resolve('b')).toEqual([B, { tag: 'b' }]);
    });

    it('resolve returns undefined for unknown labels and invalid entries', () => {
        const list = xnew(SceneList, { list: { bad: (() => {}) as any } }); // bare Component is not a valid entry

        expect(list.resolve('nowhere')).toBeUndefined();
        expect(list.resolve('bad')).toBeUndefined();
    });

    it('creates no children — it only holds the table', () => {
        const A = jest.fn();
        const list = xnew(SceneList, { list: { a: [A] } });

        expect(A).not.toHaveBeenCalled();
        expect(list.element.children.length).toBe(0);
    });
});
