import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';

describe('xnew.emit', () => {
    beforeEach(() => {
        Unit.reset();
    });
    afterEach(() => {
        Unit.engineRoot?.finalize();
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
