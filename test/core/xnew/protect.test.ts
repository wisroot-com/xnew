import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';

//----------------------------------------------------------------------------------------------------
// xnew.protect — traced real semantics (see src/core/xnew.ts protect + src/core/unit.ts emit/find)
//
// xnew.protect() sets `Unit.currentUnit._.protected = true` (xnew.ts:349). The ONLY place that flag
// is read is Unit.emit's '+global' path (unit.ts:412-425):
//
//   - `current`   = Unit.currentUnit (the emitting unit)
//   - `ancestors` = every ancestor of `current` (walking `_.parent`)
//   - for each registered listener, walk up from `entry.owner` (the unit whose scope called `on` —
//     NOT the unit the listener sits on) to the NEAREST protected unit `boundary`. Deliver only when:
//         boundary === undefined            (no protected unit on the owner's chain), OR
//         ancestors.includes(boundary)      (the protected boundary is an ancestor of the emitter), OR
//         current === boundary              (the emitter IS the protected unit)
//
// Walking the OWNER is what makes the wall sit around the subtree's own listeners rather than around
// its units: a listener registered from outside still fires even when its target lives inside the
// protected subtree, while a listener the subtree registered on itself stays blocked.
//
// Observable boundary: a protected unit blocks '+global' events from reaching listeners registered
// inside its subtree WHEN the event is emitted from OUTSIDE that subtree. If the emitter sits inside
// (or is) the protected subtree, delivery proceeds normally.
//
// Unit.find applies the SAME scope-dependent boundary: the DESCENDANTS of a protected unit are
// excluded from xnew.find when the search runs from OUTSIDE the protected subtree, but are visible
// when find runs from inside it. The protected unit ITSELF stays findable (only its subtree hides).
//----------------------------------------------------------------------------------------------------

describe('xnew.protect', () => {
    beforeEach(() => {
        Unit.reset();
    });
    afterEach(() => {
        Unit.engineRoot?.finalize();
    });

    it('is idempotent when called multiple times', () => {
        expect(() => {
            xnew((unit: Unit) => {
                void unit;
                xnew.protect();
                xnew.protect();
            });
        }).not.toThrow();
    });

    describe('global emit boundary', () => {
        it('blocks a global event from reaching a protected subtree when emitted from outside', () => {
            const cb = jest.fn();
            xnew(() => {
                // protected branch: listener lives inside a protected parent
                xnew((protectedParent: Unit) => {
                    void protectedParent;
                    xnew.protect();
                    xnew((listenerUnit: Unit) => listenerUnit.on('+ping', cb));
                });
                // emitter in an unrelated branch, OUTSIDE the protected subtree
                xnew((emitterUnit: Unit) => {
                    void emitterUnit;
                    xnew.emit('+ping');
                });
            });
            expect(cb).not.toHaveBeenCalled();
        });

        it('still delivers a global event emitted from inside the protected subtree', () => {
            const cb = jest.fn();
            xnew(() => {
                xnew((protectedParent: Unit) => {
                    void protectedParent;
                    xnew.protect();
                    // both listener and emitter are inside the protected subtree
                    xnew((listenerUnit: Unit) => listenerUnit.on('+ping', cb));
                    xnew((emitterUnit: Unit) => {
                        void emitterUnit;
                        xnew.emit('+ping');
                    });
                });
            });
            expect(cb).toHaveBeenCalledTimes(1);
        });

        it('blocks a listener the protected unit registered on itself in its own scope', () => {
            const cb = jest.fn();
            xnew(() => {
                xnew((a: Unit) => {
                    xnew.protect();
                    a.on('+ping', cb);   // owner is `a` itself — inside the boundary
                });
                xnew((emitterUnit: Unit) => {
                    void emitterUnit;
                    xnew.emit('+ping');
                });
            });
            expect(cb).not.toHaveBeenCalled();
        });

        it('delivers to a listener the outside scope registered on the protected unit', () => {
            const cb = jest.fn();
            xnew(() => {
                let a!: Unit;
                xnew(() => {
                    a = xnew((unit: Unit) => { void unit; xnew.protect(); });
                });
                a.on('+ping', cb);   // owner is the root scope — outside the boundary
                xnew((emitterUnit: Unit) => {
                    void emitterUnit;
                    xnew.emit('+ping');
                });
            });
            expect(cb).toHaveBeenCalledTimes(1);
        });

        it('delivers to a listener the outside scope registered on a unit inside the protected subtree', () => {
            const cb = jest.fn();
            xnew(() => {
                let child!: Unit;
                xnew((a: Unit) => {
                    void a;
                    xnew.protect();
                    child = xnew((unit: Unit) => { void unit; });
                });
                child.on('+ping', cb);   // owner is the root scope — outside the boundary
                xnew((emitterUnit: Unit) => {
                    void emitterUnit;
                    xnew.emit('+ping');
                });
            });
            expect(cb).toHaveBeenCalledTimes(1);
        });

        it('does not affect delivery to unprotected listeners in other branches', () => {
            const protectedCb = jest.fn();
            const openCb = jest.fn();
            xnew(() => {
                // protected branch
                xnew(() => {
                    xnew.protect();
                    xnew((u: Unit) => u.on('+ping', protectedCb));
                });
                // unprotected branch — should still receive
                xnew((u: Unit) => u.on('+ping', openCb));
                // emitter outside both branches
                xnew((emitterUnit: Unit) => {
                    void emitterUnit;
                    xnew.emit('+ping');
                });
            });
            expect(protectedCb).not.toHaveBeenCalled();
            expect(openCb).toHaveBeenCalledTimes(1);
        });
    });

    describe('find boundary', () => {
        function Child(_: Unit) {}

        it('excludes descendants of a protected unit when find is called from outside', () => {
            let child!: Unit;
            xnew(() => {
                xnew((a: Unit) => {
                    void a;
                    xnew.protect();
                    child = xnew(Child);
                });
            });
            // called from the root scope, outside the protected subtree
            expect(xnew.find(Child)).not.toContain(child);
            expect(xnew.find(Child)).toHaveLength(0);
        });

        it('includes the protected unit itself in find results', () => {
            function Panel(_: Unit) {
                xnew.protect();
            }
            let panel!: Unit;
            xnew(() => {
                panel = xnew(Panel);
            });
            expect(xnew.find(Panel)).toContain(panel);
        });

        it('still finds descendants when find is called from inside the protected subtree', () => {
            let child!: Unit;
            let foundFromInside!: Unit[];
            xnew(() => {
                xnew((a: Unit) => {
                    void a;
                    xnew.protect();
                    child = xnew(Child);
                    foundFromInside = xnew.find(Child);
                });
            });
            expect(foundFromInside).toContain(child);
        });

        it('does not exclude matching units in unrelated unprotected branches', () => {
            let openChild!: Unit;
            xnew(() => {
                xnew((a: Unit) => {
                    void a;
                    xnew.protect();
                    xnew(Child);
                });
                xnew(() => {
                    openChild = xnew(Child);
                });
            });
            const found = xnew.find(Child);
            expect(found).toContain(openChild);
            expect(found).toHaveLength(1);
        });
    });
});
