import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';

describe('xnew.standalone', () => {
    beforeEach(() => { Unit.reset(); });
    afterEach(() => { Unit.engineRoot?.destroy(); });

    it('runs the callback when the component is used on its own', () => {
        const ran = jest.fn();
        function Base() { xnew.standalone(ran); }

        xnew(Base);

        expect(ran).toHaveBeenCalledTimes(1);
    });

    it('skips the callback when the component is extended onto another', () => {
        const ran = jest.fn();
        function Base() { xnew.standalone(ran); }

        xnew(() => { xnew.extend(Base); });

        expect(ran).not.toHaveBeenCalled();
    });

    // the reason the callback exists: defines land on the unit only once the component returns,
    // so anything the body creates that reads them back has to wait for this point
    it('runs only after the component defines are on the unit', () => {
        const seen: any[] = [];
        function Base(unit: Unit) {
            seen.push((unit as any).hello);
            xnew.standalone(() => seen.push((unit as any).hello()));
            return { hello() { return 'hi'; } };
        }

        xnew(Base);

        expect(seen).toEqual([undefined, 'hi']);
    });

    it('runs the callback before the caller gets the unit back', () => {
        const order: string[] = [];
        function Base() { xnew.standalone(() => order.push('standalone')); }

        xnew(Base);
        order.push('after xnew');

        expect(order).toEqual(['standalone', 'after xnew']);
    });

    it('runs several callbacks in the order they were deferred', () => {
        const order: number[] = [];
        function Base() {
            xnew.standalone(() => order.push(1));
            xnew.standalone(() => order.push(2));
        }

        xnew(Base);

        expect(order).toEqual([1, 2]);
    });

    it('runs a callback deferred from inside another callback', () => {
        const order: string[] = [];
        function Base() {
            xnew.standalone(() => {
                order.push('outer');
                xnew.standalone(() => order.push('inner'));
            });
        }

        xnew(Base);

        expect(order).toEqual(['outer', 'inner']);
    });

    // each Unit.extend keeps its own queue, so a nested extend cannot drain or inherit its host's
    it('keeps each component queue separate when one extends another', () => {
        const order: string[] = [];
        function Inner() { xnew.standalone(() => order.push('inner')); }
        function Outer() {
            xnew.standalone(() => order.push('outer'));
            xnew.extend(Inner);
        }

        xnew(Outer);

        // Inner is extended, never standalone; Outer's own callback still runs after its body
        expect(order).toEqual(['outer']);
    });

    it('creates units in the callback under the component element, in body order', () => {
        function Child() { xnew.nest('<span>'); }
        function Base() {
            xnew.nest('<div>');
            xnew('<b>');
            xnew.standalone(() => { xnew(Child); });
        }

        const unit = xnew(Base);

        expect((unit.current as HTMLElement).innerHTML).toBe('<b></b><span></span>');
    });

    it('throws when called after initialization', () => {
        let unit!: Unit;
        xnew((u: Unit) => { unit = u; });

        expect(() => Unit.scope(Unit.snapshot(unit), () => xnew.standalone(() => {})))
            .toThrow('xnew.standalone can not be called after initialized.');
    });
});
