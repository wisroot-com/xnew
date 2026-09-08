import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';

describe('xnew.emit', () => {
    beforeEach(() => {
        Unit.reset();
    });
    afterEach(() => {
        Unit.engineRoot?.destroy();
    });

    describe('local (-)', () => {
        it('fires a local listener when emitted from the same scope', () => {
            const cb = jest.fn();
            xnew((unit: Unit) => {
                unit.on('-ping', cb);
                xnew.emit('-ping');
            });
            expect(cb).toHaveBeenCalledTimes(1);
        });

        it('does not fire a local listener registered on a different scope', () => {
            const cb = jest.fn();
            xnew(() => {
                // listener lives on a sibling unit's scope
                xnew((listenerUnit: Unit) => listenerUnit.on('-ping', cb));
                // emit happens from a different unit's scope
                xnew(() => xnew.emit('-ping'));
            });
            expect(cb).not.toHaveBeenCalled();
        });
    });

    describe('global (+)', () => {
        it('broadcasts a global event across the tree', () => {
            const cb = jest.fn();
            xnew(() => {
                xnew((listenerUnit: Unit) => listenerUnit.on('+ping', cb));
                xnew((emitterUnit: Unit) => {
                    void emitterUnit;
                    xnew.emit('+ping');
                });
            });
            expect(cb).toHaveBeenCalledTimes(1);
        });

        it('a child can receive a global event emitted elsewhere', () => {
            const cb = jest.fn();
            xnew(() => {
                // listener nested deeper in the tree
                xnew(() => {
                    xnew((listenerUnit: Unit) => listenerUnit.on('+ping', cb));
                });
                // emitter in an unrelated branch
                xnew((emitterUnit: Unit) => {
                    void emitterUnit;
                    xnew.emit('+ping');
                });
            });
            expect(cb).toHaveBeenCalledTimes(1);
        });
    });

    describe('payload', () => {
        it('forwards props to the listener with the event type', () => {
            const cb = jest.fn();
            xnew((unit: Unit) => {
                unit.on('-ping', cb);
                xnew.emit('-ping', { value: 42, label: 'hello' });
            });
            expect(cb).toHaveBeenCalledWith({ type: '-ping', value: 42, label: 'hello' });
        });

        it('fires multiple listeners in registration order', () => {
            const order: string[] = [];
            xnew((unit: Unit) => {
                unit.on('-ping', () => order.push('a'));
                unit.on('-ping', () => order.push('b'));
                unit.on('-ping', () => order.push('c'));
                xnew.emit('-ping');
            });
            expect(order).toEqual(['a', 'b', 'c']);
        });
    });

    // a listener may destroy other units mid-dispatch, and the target list was copied before that happened
    describe('dying units', () => {
        it('skips a listener whose unit an earlier listener destroyed', () => {
            const first = jest.fn();
            const second = jest.fn();
            xnew(() => {
                let victim!: Unit;
                xnew((a: Unit) => a.on('+ping', () => { first(); victim.destroy(); }));
                victim = xnew((b: Unit) => b.on('+ping', second));
                xnew(() => xnew.emit('+ping'));
            });
            expect(first).toHaveBeenCalledTimes(1);
            expect(second).not.toHaveBeenCalled();
        });

        it('does not fire a self emit on a unit that is destroying', () => {
            const cb = jest.fn();
            xnew(() => {
                const unit = xnew((u: Unit) => {
                    u.on('-ping', cb);
                    u.on('destroy', () => xnew.emit('-ping'));
                });
                unit.destroy();
            });
            expect(cb).not.toHaveBeenCalled();
        });
    });

    // an unprefixed type has no dispatch path at all, so a missing '-' must not fail silently
    describe('type prefix', () => {
        it('throws on a type with neither the + nor the - prefix', () => {
            xnew((unit: Unit) => {
                unit.on('ping', () => {});
                expect(() => xnew.emit('ping')).toThrow(/must start with/);
            });
        });

        it('accepts both prefixes', () => {
            xnew(() => {
                expect(() => xnew.emit('-ping')).not.toThrow();
                expect(() => xnew.emit('+ping')).not.toThrow();
            });
        });
    });
});
