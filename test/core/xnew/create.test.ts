import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';

describe('xnew() creation', () => {
    beforeEach(() => { Unit.reset(); });
    afterEach(() => { Unit.engineRoot?.finalize(); });

    it('creates and returns a Unit from a component function', () => {
        const unit = xnew(() => {});
        expect(unit).toBeInstanceOf(Unit);
    });

    it('passes props to the component function', () => {
        const received = jest.fn();
        xnew((_u: Unit, props: { value: number }) => received(props.value), { value: 42 });
        expect(received).toHaveBeenCalledWith(42);
    });

    it('hosts created units under the root unit established by reset()', () => {
        // Unit.reset() eagerly creates the root unit (Unit.engineRoot = new Unit({ parent: null })),
        // so the root already exists before the first xnew() call rather than being
        // initialized lazily on first use.
        expect(Unit.engineRoot).not.toBeNull();
        expect(Unit.engineRoot).toBeInstanceOf(Unit);

        const root = Unit.engineRoot;
        const unit = xnew(() => {});

        // The first xnew() reuses the existing root as the parent rather than creating a new one.
        expect(Unit.engineRoot).toBe(root);
        expect(unit.parent).toBe(root);
    });

    it('initializes the engine lazily on the first xnew() call, not at module load', () => {
        jest.isolateModules(() => {
            const { Unit: FreshUnit } = require('../../../src/core/unit');
            const { xnew: freshXnew } = require('../../../src/core/xnew');

            // importing the library must not start the engine (no ticker side effect)
            expect(FreshUnit.engineRoot).toBeUndefined();

            const unit = freshXnew(() => {});
            expect(FreshUnit.engineRoot).toBeInstanceOf(FreshUnit);
            expect(unit.parent).toBe(FreshUnit.engineRoot);

            FreshUnit.engineRoot.finalize();
        });
    });

    it('creates a child whose parent is the enclosing unit', () => {
        let outer!: Unit, inner!: Unit;
        xnew((u: Unit) => { outer = u; inner = xnew(); });
        expect(inner.parent).toBe(outer);
    });

    it('hosts the unit on an explicit DOM element target', () => {
        const el = document.createElement('section');
        const unit = xnew(el, () => {});
        expect(unit.current).toBe(el);
    });

    it('creates the host element from a tag string target', () => {
        const unit = xnew('<article id="a1">', () => {});
        expect(unit.current.id).toBe('a1');
    });
});
