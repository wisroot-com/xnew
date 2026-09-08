import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';

describe('Unit.on / Unit.off', () => {
    beforeEach(() => {
        Unit.reset();
    });
    afterEach(() => {
        Unit.engineRoot?.destroy();
    });

    describe('on', () => {
        it('registers and fires a listener for a single type', () => {
            const cb = jest.fn();
            xnew((unit: Unit) => {
                unit.on('-ping', cb);
                xnew.emit('-ping', { value: 1 });
            });
            expect(cb).toHaveBeenCalledTimes(1);
            expect(cb).toHaveBeenCalledWith(expect.objectContaining({ type: '-ping', value: 1 }));
        });

        it('registers one listener for multiple space-separated types', () => {
            const cb = jest.fn();
            xnew((unit: Unit) => {
                unit.on('-a -b', cb);
                xnew.emit('-a');
                xnew.emit('-b');
            });
            expect(cb).toHaveBeenCalledTimes(2);
        });

        it('ignores duplicate (type, listener) registration', () => {
            const cb = jest.fn();
            xnew((unit: Unit) => {
                unit.on('-ping', cb);
                unit.on('-ping', cb);
                xnew.emit('-ping');
            });
            expect(cb).toHaveBeenCalledTimes(1);
        });

        it('fires distinct listeners registered for the same type', () => {
            const a = jest.fn();
            const b = jest.fn();
            xnew((unit: Unit) => {
                unit.on('-ping', a);
                unit.on('-ping', b);
                xnew.emit('-ping');
            });
            expect(a).toHaveBeenCalledTimes(1);
            expect(b).toHaveBeenCalledTimes(1);
        });

        // an entry is keyed by (listener, owner), so a handler shared between components is not swallowed
        it('registers one shared handler once per owner', () => {
            const cb = jest.fn();
            let target!: Unit;
            xnew(() => {
                target = xnew(() => {});
                xnew(() => target.on('-ping', cb));
                xnew(() => target.on('-ping', cb));
            });
            Unit.emit(target, '-ping');
            expect(cb).toHaveBeenCalledTimes(2);
        });

        it("keeps a shared handler alive for the other owner when one owner destroys", () => {
            const cb = jest.fn();
            let target!: Unit;
            let first!: Unit;
            xnew(() => {
                target = xnew(() => {});
                first = xnew(() => target.on('-ping', cb));
                xnew(() => target.on('-ping', cb));
            });
            first.destroy();
            Unit.emit(target, '-ping');
            expect(cb).toHaveBeenCalledTimes(1);
        });

        // a listener added mid-dispatch belongs to the next emit, as with the update system
        it('does not fire a listener added during the same emit', () => {
            const added = jest.fn();
            let target!: Unit;
            xnew((unit: Unit) => {
                target = unit;
                unit.on('-ping', () => unit.on('-ping', added));
            });
            Unit.emit(target, '-ping');
            expect(added).not.toHaveBeenCalled();
            Unit.emit(target, '-ping');
            expect(added).toHaveBeenCalledTimes(1);
        });

        // a destroyed target left in its owners' index would pin its whole _ bag (elements, children)
        it('drops a destroyed target from the owner index', () => {
            let target!: Unit;
            let owner!: Unit;
            xnew(() => {
                target = xnew(() => {});
                owner = xnew(() => target.on('-ping', () => {}));
            });
            expect(Unit.owner2targets.get(owner)?.has(target)).toBe(true);
            target.destroy();
            expect(Unit.owner2targets.get(owner)?.has(target) ?? false).toBe(false);
        });
    });

    describe('once', () => {
        it('fires the listener only on the first emit', () => {
            const cb = jest.fn();
            xnew((unit: Unit) => {
                unit.once('-ping', cb);
                xnew.emit('-ping', { value: 1 });
                xnew.emit('-ping', { value: 2 });
            });
            expect(cb).toHaveBeenCalledTimes(1);
            expect(cb).toHaveBeenCalledWith(expect.objectContaining({ type: '-ping', value: 1 }));
        });

        it('with space-separated types, each type fires once independently', () => {
            const cb = jest.fn();
            xnew((unit: Unit) => {
                unit.once('-a -b', cb);
                xnew.emit('-a');
                xnew.emit('-a');
                xnew.emit('-b');
                xnew.emit('-b');
            });
            expect(cb).toHaveBeenCalledTimes(2);
        });

        it('is removed before invocation, so an emit inside the listener cannot re-fire it', () => {
            const cb = jest.fn(() => xnew.emit('-ping'));
            xnew((unit: Unit) => {
                unit.once('-ping', cb);
                xnew.emit('-ping');
            });
            expect(cb).toHaveBeenCalledTimes(1);
        });

        it('once(\'update\') fires once without skipping later update listeners in the same tick', () => {
            const first = jest.fn();
            const second = jest.fn();
            const unit = xnew((unit: Unit) => {
                unit.once('update', first);
                unit.on('update', second);
            });
            Unit.update(Unit.engineRoot);
            Unit.update(Unit.engineRoot);
            expect(first).toHaveBeenCalledTimes(1);
            expect(second).toHaveBeenCalledTimes(2);
        });

        it('off() by the owner removes a pending once listener', () => {
            const cb = jest.fn();
            xnew((unit: Unit) => {
                unit.once('-ping', cb);
                unit.off();
                xnew.emit('-ping');
            });
            expect(cb).not.toHaveBeenCalled();
        });
    });

    describe('off', () => {
        it('off(type, listener) removes only that listener', () => {
            const a = jest.fn();
            const b = jest.fn();
            xnew((unit: Unit) => {
                unit.on('-ping', a);
                unit.on('-ping', b);
                unit.off('-ping', a);
                xnew.emit('-ping');
            });
            expect(a).not.toHaveBeenCalled();
            expect(b).toHaveBeenCalledTimes(1);
        });

        it('off(type) removes all listeners for the type', () => {
            const a = jest.fn();
            const b = jest.fn();
            xnew((unit: Unit) => {
                unit.on('-ping', a);
                unit.on('-ping', b);
                unit.off('-ping');
                xnew.emit('-ping');
            });
            expect(a).not.toHaveBeenCalled();
            expect(b).not.toHaveBeenCalled();
        });

        it('off() with no args removes all listeners on the unit', () => {
            const a = jest.fn();
            const b = jest.fn();
            xnew((unit: Unit) => {
                unit.on('-a', a);
                unit.on('-b', b);
                unit.off();
                xnew.emit('-a');
                xnew.emit('-b');
            });
            expect(a).not.toHaveBeenCalled();
            expect(b).not.toHaveBeenCalled();
        });

        it('off(type) from a non-owner unit keeps other units\' listeners', () => {
            const cb = jest.fn();
            const system = xnew((unit: Unit) => ({ ping() { xnew.emit('-ping'); } }));
            xnew((unit: Unit) => { system.on('-ping', cb); });   // subscriber (e.g. Accordion)
            xnew((unit: Unit) => { system.off('-ping'); });      // outsider blanket off
            system.ping();
            expect(cb).toHaveBeenCalledTimes(1);
        });

        it('off() removes only the listeners the calling unit registered', () => {
            const mine = jest.fn();
            const theirs = jest.fn();
            const system = xnew((unit: Unit) => ({ ping() { xnew.emit('-ping'); } }));
            xnew((unit: Unit) => { system.on('-ping', theirs); });
            xnew((unit: Unit) => {
                system.on('-ping', mine);
                system.off();
            });
            system.ping();
            expect(mine).not.toHaveBeenCalled();
            expect(theirs).toHaveBeenCalledTimes(1);
        });

        it('off(type, listener) from a non-owner unit keeps the listener', () => {
            const cb = jest.fn();
            const system = xnew((unit: Unit) => ({ ping() { xnew.emit('-ping'); } }));
            xnew((unit: Unit) => { system.on('-ping', cb); });
            xnew((unit: Unit) => { system.off('-ping', cb); });
            system.ping();
            expect(cb).toHaveBeenCalledTimes(1);
        });

        it('off(\'update\') from a non-owner unit keeps other units\' update listeners', () => {
            const cb = jest.fn();
            const target = xnew((unit: Unit) => {});
            xnew((unit: Unit) => { target.on('update', cb); });
            xnew((unit: Unit) => { target.off('update'); });
            Unit.update(Unit.engineRoot);
            expect(cb).toHaveBeenCalledTimes(1);
        });

        it('destroying the owner detaches its listeners from other units', () => {
            const cb = jest.fn();
            const system = xnew((unit: Unit) => ({ ping() { xnew.emit('-ping'); } }));
            const subscriber = xnew((unit: Unit) => { system.on('-ping', cb); });
            subscriber.destroy();
            expect(system._.listeners.has('-ping')).toBe(false);
            system.ping();
            expect(cb).not.toHaveBeenCalled();
        });

        it('destroying the owner clears its registry, even after the target is gone', () => {
            const cb = jest.fn();
            const target = xnew((unit: Unit) => {});
            const owner = xnew((unit: Unit) => { target.on('-ping', cb); });
            target.destroy();
            owner.destroy();
            expect(Unit.owner2targets.has(owner)).toBe(false);
        });

        it('off accepts space-separated types', () => {
            const cb = jest.fn();
            xnew((unit: Unit) => {
                unit.on('-a -b -c', cb);
                unit.off('-a -b');
                xnew.emit('-a');
                xnew.emit('-b');
                xnew.emit('-c');
            });
            expect(cb).toHaveBeenCalledTimes(1);
            expect(cb).toHaveBeenCalledWith(expect.objectContaining({ type: '-c' }));
        });
    });
});
