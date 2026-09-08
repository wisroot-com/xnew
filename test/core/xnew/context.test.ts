import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';

describe('xnew.context', () => {
    beforeEach(() => { Unit.reset(); });
    afterEach(() => { Unit.engineRoot?.destroy(); });

    it('finds an ancestor that extended the given component', () => {
        function Theme(_: Unit) {
            return { get name() { return 'dark'; } };
        }

        let themeUnit!: Unit;
        const resolved = jest.fn();
        xnew((unit: Unit) => {
            themeUnit = unit;
            xnew.extend(Theme);
            xnew(() => {
                resolved(xnew.context(Theme));
            });
        });

        expect(resolved).toHaveBeenCalledTimes(1);
        const found = resolved.mock.calls[0][0] as Unit & { name: string };
        expect(found).toBe(themeUnit);
        expect(found.name).toBe('dark');
    });

    it('finds an ancestor created directly with the component as its function', () => {
        function Provider(_: Unit) {
            return { get token() { return 'abc'; } };
        }

        let providerUnit!: Unit;
        const resolved = jest.fn();
        xnew(() => {
            providerUnit = xnew(Provider);
            // child created inside the provider's scope
            xnew(providerUnit, () => {
                resolved(xnew.context(Provider));
            });
        });

        const found = resolved.mock.calls[0][0] as Unit & { token: string };
        expect(found).toBe(providerUnit);
        expect(found.token).toBe('abc');
    });

    it('returns undefined when no ancestor exposes the component', () => {
        function Absent(_: Unit) {}

        const resolved = jest.fn();
        xnew(() => {
            xnew(() => {
                resolved(xnew.context(Absent));
            });
        });

        expect(resolved).toHaveBeenCalledTimes(1);
        expect(resolved.mock.calls[0][0]).toBeUndefined();
    });

    it('returns the nearest ancestor when multiple ancestors match', () => {
        function Scope(unit: Unit, props: { label: string }) {
            return { get label() { return props.label; } };
        }

        let outerScope!: Unit;
        let innerScope!: Unit;
        const resolved = jest.fn();

        xnew(() => {
            outerScope = xnew(Scope, { label: 'outer' });
            xnew(outerScope, () => {
                innerScope = xnew(Scope, { label: 'inner' });
                xnew(innerScope, () => {
                    resolved(xnew.context(Scope));
                });
            });
        });

        const found = resolved.mock.calls[0][0] as Unit & { label: string };
        expect(found).toBe(innerScope);
        expect(found.label).toBe('inner');
        expect(found).not.toBe(outerScope);
    });
});
