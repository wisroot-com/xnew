import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';

//----------------------------------------------------------------------------------------------------
// Typed defines (theme 2)
//
// xnew(Component) returns `Unit & DefinesOf<Component>`, and xnew.extend(Component) returns
// `DefinesOf<Component>`. Unit carries a `[key: string]: any` index signature (defines are attached
// at runtime and can't be tracked statically), so declared defines keep their types while undeclared
// access on a unit resolves to `any` instead of erroring. The bare object returned by xnew.extend has
// no Unit, so it stays strictly typed: undeclared access there is still a compile error (asserted with
// a ts-expect-error directive below). These checks run under ts-jest, so a type regression fails the
// build, and the runtime expectations confirm the defines are actually wired onto the unit.
//----------------------------------------------------------------------------------------------------

function Counter(_unit: Unit, props: { start?: number }) {
    let n = props.start ?? 0;
    return {
        inc() { n++; },
        get value() { return n; },
    };
}

describe('typed defines', () => {
    beforeEach(() => {
        Unit.reset();
    });
    afterEach(() => {
        Unit.engineRoot?.destroy();
    });

    it('xnew(Component) merges typed defines onto the returned unit', () => {
        xnew(() => {
            const counter = xnew(Counter, { start: 10 });
            counter.inc();                          // typed method
            expect(counter.value).toBe(11);         // typed getter
            expect(typeof counter.on).toBe('function'); // still a Unit
            expect(counter.nope).toBeUndefined();   // undeclared access resolves to any (Unit index signature)
        });
    });

    it('xnew.extend(Component) returns typed defines', () => {
        xnew(() => {
            const api = xnew.extend(Counter, { start: 5 });
            api.inc();
            expect(api.value).toBe(6);
            // @ts-expect-error — undeclared define is a type error
            api.nope;
        });
    });

    it('a component returning nothing yields a bare Unit', () => {
        xnew(() => {
            const plain = xnew((_unit: Unit) => { /* no defines */ });
            expect(typeof plain.destroy).toBe('function');
            expect(plain.anything).toBeUndefined();   // bare Unit still allows any access via index signature
        });
    });
});
