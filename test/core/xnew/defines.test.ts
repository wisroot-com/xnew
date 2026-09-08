import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';

//----------------------------------------------------------------------------------------------------
// Defines (theme 2)
//
// Defines are attached onto the unit at runtime, so they are deliberately NOT tracked statically:
// xnew(Component) returns a plain `Unit` and xnew.extend(Component) returns `Record<string, any>`.
// Unit carries a `[key: string]: any` index signature, so any member access compiles and resolves to
// `any` — declared or not. Props are the one thing that stays typed (PropsOf), which the last case
// pins down with a ts-expect-error. These checks run under ts-jest, so a type regression fails the
// build, and the runtime expectations confirm the defines are actually wired onto the unit.
//----------------------------------------------------------------------------------------------------

function Counter(_unit: Unit, props: { start?: number }) {
    let n = props.start ?? 0;
    return {
        inc() { n++; },
        get value() { return n; },
    };
}

describe('defines', () => {
    beforeEach(() => {
        Unit.reset();
    });
    afterEach(() => {
        Unit.engineRoot?.destroy();
    });

    it('xnew(Component) attaches the defines onto the returned unit', () => {
        xnew(() => {
            const counter = xnew(Counter, { start: 10 });
            counter.inc();
            expect(counter.value).toBe(11);
            expect(typeof counter.on).toBe('function'); // still a Unit
            expect(counter.nope).toBeUndefined();       // undeclared access resolves to any (Unit index signature)
        });
    });

    it('xnew.extend(Component) returns the defines', () => {
        xnew(() => {
            const api = xnew.extend(Counter, { start: 5 });
            api.inc();
            expect(api.value).toBe(6);
            expect(api.nope).toBeUndefined();           // untyped too — Record<string, any>
        });
    });

    it('a component returning nothing yields a bare Unit', () => {
        xnew(() => {
            const plain = xnew((_unit: Unit) => { /* no defines */ });
            expect(typeof plain.destroy).toBe('function');
            expect(plain.anything).toBeUndefined();
        });
    });

    it('props stay typed even though defines do not', () => {
        xnew(() => {
            // @ts-expect-error — start is a number
            xnew(Counter, { start: 'five' });
        });
    });

    it('props may be omitted only when every prop is optional', () => {
        function Needs(_unit: Unit, props: { value: number }) { return { get value() { return props.value; } }; }

        xnew(() => {
            // @ts-expect-error — value is required, so the props argument is required too
            xnew(Needs);
            expect(xnew(Needs, { value: 1 }).value).toBe(1);
            expect(xnew(Counter).value).toBe(0);              // every prop optional -> omittable
            expect(typeof xnew((_unit: Unit) => { /* no props */ }).destroy).toBe('function');
        });
    });
});
