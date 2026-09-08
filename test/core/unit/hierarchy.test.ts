import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';

describe('Unit hierarchy', () => {
    beforeEach(() => { Unit.reset(); });
    afterEach(() => { Unit.engineRoot?.destroy(); });

    it('a unit created inside a component has that component as parent', () => {
        let outer!: Unit, inner!: Unit;
        xnew((u: Unit) => { outer = u; inner = xnew(); });
        expect(inner.parent).toBe(outer);
    });

    it('a top-level unit has the root unit as parent', () => {
        const unit = xnew(() => {});
        expect(unit.parent).toBe(Unit.engineRoot);
    });

    it('destroying a parent destroys its children', () => {
        const onChildDestroy = jest.fn();
        const parent = xnew(() => {
            xnew((c: Unit) => c.on('destroy', onChildDestroy));
        });
        parent.destroy();
        expect(onChildDestroy).toHaveBeenCalledTimes(1);
    });

    it('destroys children in reverse creation order', () => {
        const order: string[] = [];
        const parent = xnew(() => {
            xnew((c: Unit) => c.on('destroy', () => order.push('a')));
            xnew((c: Unit) => c.on('destroy', () => order.push('b')));
            xnew((c: Unit) => c.on('destroy', () => order.push('c')));
        });
        parent.destroy();
        expect(order).toEqual(['c', 'b', 'a']);
    });

    it('removes a destroyed child so it is no longer found', () => {
        function Child(_: Unit) {}
        let child!: Unit;
        const parent = xnew(() => { child = xnew(Child); });
        expect(xnew.find(Child)).toContain(child);
        child.destroy();
        expect(xnew.find(Child)).not.toContain(child);
        parent.destroy();
    });
});

describe('Unit childattach / childdetach', () => {
    beforeEach(() => { Unit.reset(); });
    afterEach(() => { Unit.engineRoot?.destroy(); });

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
        parent.destroy();
    });

    it('fires childdetach on the parent after the child is destroyed', () => {
        const detached: Array<{ child: Unit, destroyed: boolean, removed: boolean }> = [];
        let child!: Unit;
        const parent = xnew((u: Unit) => {
            u.on('childdetach', ({ child }: any) => {
                detached.push({ child, destroyed: child._.phase === 'destroyed', removed: u._.children.includes(child) === false });
            });
            child = xnew(() => {});
        });
        expect(detached).toEqual([]);
        child.destroy();
        expect(detached).toEqual([{ child, destroyed: true, removed: true }]);
        parent.destroy();
    });

    it('fires childdetach for every child while the parent itself is destroying', () => {
        const order: string[] = [];
        const parent = xnew((u: Unit) => {
            u.on('childdetach', ({ child }: any) => order.push(child._.key));
            u.on('destroy', () => order.push('parent'));
            xnew(() => {}, { key: 'a' });
            xnew(() => {}, { key: 'b' });
        });
        parent.destroy();
        // 子は逆順に destroy され、親自身の destroy リスナはその後に走る。
        expect(order).toEqual(['b', 'a', 'parent']);
    });

    it('passes the event type and does not bind the child events to the DOM element', () => {
        const types: string[] = [];
        const parent = xnew('<div>', (u: Unit) => {
            u.on('childattach childdetach', ({ type }: any) => types.push(type));
            xnew(() => {}).destroy();
        });
        expect(types).toEqual(['childattach', 'childdetach']);
        // DOM 側の登録経路（listeners / type2units）には一切載らない。
        expect(parent._.listeners.has('childattach')).toBe(false);
        expect(Unit.type2units.get('childattach')).toBeUndefined();
        parent.destroy();
    });

    it('does not fire the pair for a unit that destroys inside its own component body', () => {
        const events: string[] = [];
        const parent = xnew((u: Unit) => {
            u.on('childattach childdetach', ({ type }: any) => events.push(type));
            xnew((c: Unit) => { c.destroy(); });
        });
        expect(events).toEqual([]);
        parent.destroy();
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
        parent.destroy();
    });
});
