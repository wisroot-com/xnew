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
        // Unit.reset() eagerly creates the root unit (Unit.engineRoot = new Unit(null)),
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

    it('initializes the engine at module load, so the first xnew() needs no bootstrap', () => {
        jest.isolateModules(() => {
            const { Unit: FreshUnit } = require('../../../src/core/unit');
            const { xnew: freshXnew } = require('../../../src/core/xnew');

            // the class's static block boots the engine: root and current unit exist before any call
            expect(FreshUnit.engineRoot).toBeInstanceOf(FreshUnit);
            expect(FreshUnit.currentUnit).toBe(FreshUnit.engineRoot);

            const unit = freshXnew(() => {});
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

    // a leading string is always read as a tag, so text content needs an explicit target: xnew('<p>', 'text')
    it('rejects a bare string as text content', () => {
        expect(() => (xnew as any)('plain text')).toThrow(/invalid tag string/);
    });

    it('rejects a bare number as text content', () => {
        expect(() => (xnew as any)(42)).toThrow(/text content needs a nested element/);
    });

    // writing text would replace the element's whole content, so a borrowed target is refused too
    it('rejects text content on an explicit DOM element target', () => {
        const el = document.createElement('section');
        el.appendChild(document.createElement('span'));
        expect(() => (xnew as any)(el, 'text')).toThrow(/text content needs a nested element/);
        expect(el.children.length).toBe(1);
    });

    it('writes text content onto an explicit target', () => {
        expect(xnew('<p>', 42).current.textContent).toBe('42');
    });

    it('creates the host element from a tag string target', () => {
        const unit = xnew('<article id="a1">', () => {});
        expect(unit.current.id).toBe('a1');
    });
});
