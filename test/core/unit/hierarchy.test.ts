import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';

describe('Unit hierarchy', () => {
    beforeEach(() => { Unit.reset(); });
    afterEach(() => { Unit.engineRoot?.finalize(); });

    it('a unit created inside a component has that component as parent', () => {
        let outer!: Unit, inner!: Unit;
        xnew((u: Unit) => { outer = u; inner = xnew(); });
        expect(inner.parent).toBe(outer);
    });

    it('a top-level unit has the root unit as parent', () => {
        const unit = xnew(() => {});
        expect(unit.parent).toBe(Unit.engineRoot);
    });

    it('finalizing a parent finalizes its children', () => {
        const onChildFinalize = jest.fn();
        const parent = xnew(() => {
            xnew((c: Unit) => c.on('finalize', onChildFinalize));
        });
        parent.finalize();
        expect(onChildFinalize).toHaveBeenCalledTimes(1);
    });

    it('finalizes children in reverse creation order', () => {
        const order: string[] = [];
        const parent = xnew(() => {
            xnew((c: Unit) => c.on('finalize', () => order.push('a')));
            xnew((c: Unit) => c.on('finalize', () => order.push('b')));
            xnew((c: Unit) => c.on('finalize', () => order.push('c')));
        });
        parent.finalize();
        expect(order).toEqual(['c', 'b', 'a']);
    });

    it('removes a finalized child so it is no longer found', () => {
        function Child(_: Unit) {}
        let child!: Unit;
        const parent = xnew(() => { child = xnew(Child); });
        expect(xnew.find(Child)).toContain(child);
        child.finalize();
        expect(xnew.find(Child)).not.toContain(child);
        parent.finalize();
    });
});

describe('Unit childattach / childdetach', () => {
    beforeEach(() => { Unit.reset(); });
    afterEach(() => { Unit.engineRoot?.finalize(); });

    it('fires childattach on the parent once the child constructor is complete', () => {
        const attached: Array<{ child: Unit, initialized: boolean, defined: boolean }> = [];
        let child!: Unit;
        const parent = xnew((u: Unit) => {
            u.on('childattach', ({ child }: any) => {
                // コンストラクタ完了後なので、defines も phase も出来上がった姿で渡る。
                attached.push({ child, initialized: child._.phase === 'initialized', defined: typeof child.hello === 'function' });
            });
            child = xnew(() => ({ hello: () => 'hi' }));
        });
        expect(attached).toEqual([{ child, initialized: true, defined: true }]);
        parent.finalize();
    });

    it('fires childdetach on the parent after the child is finalized', () => {
        const detached: Array<{ child: Unit, finalized: boolean, removed: boolean }> = [];
        let child!: Unit;
        const parent = xnew((u: Unit) => {
            u.on('childdetach', ({ child }: any) => {
                detached.push({ child, finalized: child._.phase === 'finalized', removed: u._.children.includes(child) === false });
            });
            child = xnew(() => {});
        });
        expect(detached).toEqual([]);
        child.finalize();
        expect(detached).toEqual([{ child, finalized: true, removed: true }]);
        parent.finalize();
    });

    it('fires childdetach for every child while the parent itself is finalizing', () => {
        const order: string[] = [];
        const parent = xnew((u: Unit) => {
            u.on('childdetach', ({ child }: any) => order.push(child._.key));
            u.on('finalize', () => order.push('parent'));
            xnew(() => {}, { key: 'a' });
            xnew(() => {}, { key: 'b' });
        });
        parent.finalize();
        // 子は逆順に finalize され、親自身の finalize リスナはその後に走る。
        expect(order).toEqual(['b', 'a', 'parent']);
    });

    it('passes the event type and does not bind the child events to the DOM element', () => {
        const types: string[] = [];
        const parent = xnew('<div>', (u: Unit) => {
            u.on('childattach childdetach', ({ type }: any) => types.push(type));
            xnew(() => {}).finalize();
        });
        expect(types).toEqual(['childattach', 'childdetach']);
        // DOM 側の登録経路（listeners / type2units）には一切載らない。
        expect(parent._.listeners.has('childattach')).toBe(false);
        expect(Unit.type2units.get('childattach')).toBeUndefined();
        parent.finalize();
    });

    it('does not fire the pair for a unit that finalizes inside its own component body', () => {
        const events: string[] = [];
        const parent = xnew((u: Unit) => {
            u.on('childattach childdetach', ({ type }: any) => events.push(type));
            xnew((c: Unit) => { c.finalize(); });
        });
        expect(events).toEqual([]);
        parent.finalize();
    });

    it('stops firing after off', () => {
        const onAttach = jest.fn();
        const parent = xnew((u: Unit) => {
            u.on('childattach', onAttach);
            xnew(() => {});
            u.off('childattach', onAttach);
            xnew(() => {});
        });
        expect(onAttach).toHaveBeenCalledTimes(1);
        parent.finalize();
    });
});
