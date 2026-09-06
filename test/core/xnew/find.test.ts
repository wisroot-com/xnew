import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';

describe('xnew.find', () => {
    beforeEach(() => { Unit.reset(); });
    afterEach(() => { Unit.engineRoot?.finalize(); });

    it('returns every unit registered under the given component', () => {
        function A(_: Unit) {}
        function B(_: Unit) {}
        let a1!: Unit, a2!: Unit, b1!: Unit;
        xnew(() => { a1 = xnew(A); a2 = xnew(A); b1 = xnew(B); });
        expect(xnew.find(A)).toEqual(expect.arrayContaining([a1, a2]));
        expect(xnew.find(A)).toHaveLength(2);
        expect(xnew.find(B)).toEqual([b1]);
    });

    it('returns an empty array when no unit matches', () => {
        function Absent(_: Unit) {}
        expect(xnew.find(Absent)).toEqual([]);
    });

    it('drops a unit from the index after finalize', () => {
        function A(_: Unit) {}
        const unit = xnew(A);
        expect(xnew.find(A)).toContain(unit);
        unit.finalize();
        expect(xnew.find(A)).not.toContain(unit);
    });

    describe('by reserved key prop', () => {
        function A(_: Unit) {}

        it('stores the key prop on the unit (_.key)', () => {
            const a = xnew(A, { key: 'k1', extra: 1 });
            expect(a._.key).toBe('k1');
            expect(xnew(A)._.key).toBeNull();   // 未指定なら null
        });

        it('filters results to the matching key', () => {
            let a1!: Unit, a2!: Unit;
            xnew(() => { a1 = xnew(A, { key: 'k1' }); a2 = xnew(A, { key: 'k2' }); });
            expect(xnew.find(A, { key: 'k1' })).toEqual([a1]);
            expect(xnew.find(A, { key: 'k2' })).toEqual([a2]);
            expect(xnew.find(A, { key: 'missing' })).toEqual([]);
        });

        it('excludes keyless units when a key is given, but includes them without one', () => {
            let keyed!: Unit, keyless!: Unit;
            xnew(() => { keyed = xnew(A, { key: 'k1' }); keyless = xnew(A); });
            expect(xnew.find(A, { key: 'k1' })).toEqual([keyed]);
            expect(xnew.find(A)).toEqual(expect.arrayContaining([keyed, keyless]));
            expect(xnew.find(A)).toHaveLength(2);
        });

        it('preserves falsy keys (0 / empty string) rather than treating them as absent', () => {
            const zero = xnew(A, { key: 0 });
            expect(zero._.key).toBe(0);
            expect(xnew.find(A, { key: 0 })).toEqual([zero]);
        });
    });

    describe('by ancestor', () => {
        function A(_: Unit) {}

        it('limits results to the descendants of the given unit', () => {
            let ancestor!: Unit, inner!: Unit, deep!: Unit, outer!: Unit;
            xnew(() => {
                ancestor = xnew(() => {
                    inner = xnew(A);
                    xnew(() => { deep = xnew(A); });
                });
                outer = xnew(A);
            });
            expect(xnew.find(A, { ancestor })).toEqual(expect.arrayContaining([inner, deep]));
            expect(xnew.find(A, { ancestor })).toHaveLength(2);
            expect(xnew.find(A, { ancestor })).not.toContain(outer);
        });

        it('excludes the given unit itself', () => {
            let ancestor!: Unit, child!: Unit;
            xnew(() => { ancestor = xnew(A, () => { child = xnew(A); }); });
            expect(xnew.find(A, { ancestor })).toEqual([child]);
        });

        it('combines with key', () => {
            let ancestor!: Unit, k1!: Unit;
            xnew(() => {
                ancestor = xnew(() => { k1 = xnew(A, { key: 'k1' }); xnew(A, { key: 'k2' }); });
                xnew(A, { key: 'k3' });
            });
            expect(xnew.find(A, { ancestor, key: 'k1' })).toEqual([k1]);
            expect(xnew.find(A, { ancestor, key: 'k3' })).toEqual([]);
        });
    });

    describe('by parent', () => {
        function A(_: Unit) {}

        it('limits results to the direct children of the given unit', () => {
            let parent!: Unit, child!: Unit, deep!: Unit, outer!: Unit;
            xnew(() => {
                parent = xnew(() => {
                    child = xnew(A);
                    xnew(() => { deep = xnew(A); });
                });
                outer = xnew(A);
            });
            expect(xnew.find(A, { parent })).toEqual([child]);
            expect(xnew.find(A, { parent })).not.toContain(deep);
            expect(xnew.find(A, { parent })).not.toContain(outer);
        });

        it('excludes the given unit itself', () => {
            let parent!: Unit;
            xnew(() => { parent = xnew(A); });
            expect(xnew.find(A, { parent })).toEqual([]);
        });

        it('combines with key', () => {
            let parent!: Unit, k1!: Unit;
            xnew(() => {
                parent = xnew(() => { k1 = xnew(A, { key: 'k1' }); xnew(A, { key: 'k2' }); });
                xnew(A, { key: 'k1' });
            });
            expect(xnew.find(A, { parent, key: 'k1' })).toEqual([k1]);
        });

        it('intersects with ancestor rather than conflicting', () => {
            let ancestor!: Unit, parent!: Unit, child!: Unit;
            xnew(() => {
                ancestor = xnew(() => {
                    parent = xnew(() => { child = xnew(A); });
                });
            });
            expect(xnew.find(A, { ancestor, parent })).toEqual([child]);
            expect(xnew.find(A, { ancestor: parent, parent: ancestor })).toEqual([]);
        });
    });
});
