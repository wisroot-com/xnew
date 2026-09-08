import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';

describe('xnew.extend', () => {
    beforeEach(() => { Unit.reset(); });
    afterEach(() => { Unit.engineRoot?.destroy(); });

    describe('basic composition', () => {
        it('exposes base methods on the unit', () => {
            function Base(_: Unit) { return { hello() { return 'hi'; } }; }
            const result = jest.fn();
            xnew((unit: Unit) => {
                xnew.extend(Base);
                result((unit as any).hello());
            });
            expect(result).toHaveBeenCalledWith('hi');
        });

        it('combines methods from multiple bases', () => {
            function Base1(_: Unit) { return { getValue1() { return 10; } }; }
            function Base2(_: Unit) { return { getValue2() { return 20; } }; }
            function Derived(unit: Unit) {
                xnew.extend(Base1);
                xnew.extend(Base2);
                return { getSum() { return (unit as any).getValue1() + (unit as any).getValue2(); } };
            }

            const unit = xnew(Derived) as any;
            expect(unit.getValue1()).toBe(10);
            expect(unit.getValue2()).toBe(20);
            expect(unit.getSum()).toBe(30);
        });

        it('supports multi-level extension', () => {
            function Base(_: Unit) { return { baseMethod() { return 'base'; } }; }
            function Middle(unit: Unit) {
                xnew.extend(Base);
                return { middleMethod() { return (unit as any).baseMethod() + '-middle'; } };
            }
            function Derived(unit: Unit) {
                xnew.extend(Middle);
                return { derivedMethod() { return (unit as any).middleMethod() + '-derived'; } };
            }

            const unit = xnew(Derived) as any;
            expect(unit.baseMethod()).toBe('base');
            expect(unit.middleMethod()).toBe('base-middle');
            expect(unit.derivedMethod()).toBe('base-middle-derived');
        });

        it('returns the accumulated defines from the extended component', () => {
            function Base(_: Unit) { return { ping() { return 'pong'; } }; }
            const captured = jest.fn();
            xnew(() => {
                const defines = xnew.extend(Base);
                captured(typeof defines.ping, defines.ping());
            });
            expect(captured).toHaveBeenCalledWith('function', 'pong');
        });
    });

    describe('override', () => {
        it('derived definition overrides a base method', () => {
            // Override resolution is unit-level: Base.getDouble reads unit.getValue,
            // which Derived has redefined, so both calls observe the derived value.
            function Base(unit: Unit) {
                return {
                    getValue() { return 100; },
                    getDouble() { return (unit as any).getValue() * 2; },
                };
            }
            function Derived(_: Unit) {
                xnew.extend(Base);
                return { getValue() { return 50; } };
            }

            const unit = xnew(Derived) as any;
            expect(unit.getValue()).toBe(50);
            expect(unit.getDouble()).toBe(100);
        });

        it('the last extended base wins on name collision', () => {
            function Base1(_: Unit) { return { getName() { return 'Base1'; } }; }
            function Base2(_: Unit) { return { getName() { return 'Base2'; } }; }
            function Derived(_: Unit) {
                xnew.extend(Base1);
                xnew.extend(Base2);
                return {};
            }

            expect((xnew(Derived) as any).getName()).toBe('Base2');
        });
    });

    describe('shared state', () => {
        it('shares the unit instance across base and derived methods', () => {
            function Base(unit: Unit) {
                (unit as any).counter = 0;
                return {
                    increment() { (unit as any).counter++; },
                    getCounter() { return (unit as any).counter; },
                };
            }
            function Derived(unit: Unit) {
                xnew.extend(Base);
                return { incrementBy(value: number) { (unit as any).counter += value; } };
            }

            const unit = xnew(Derived) as any;
            unit.increment();
            unit.increment();
            expect(unit.getCounter()).toBe(2);
            unit.incrementBy(5);
            expect(unit.getCounter()).toBe(7);
        });

        it('passes props through to the extended component', () => {
            function ConfigurableBase(_: Unit, options: { prefix: string }) {
                return { format(text: string) { return `${options.prefix}: ${text}`; } };
            }
            function Derived(unit: Unit) {
                xnew.extend(ConfigurableBase, { prefix: 'LOG' });
                return { logMessage(message: string) { return (unit as any).format(message); } };
            }

            expect((xnew(Derived) as any).logMessage('test')).toBe('LOG: test');
        });
    });

    describe('init order', () => {
        it('initializes the base at the extend call site', () => {
            const log: string[] = [];

            function Base(_: Unit) {
                log.push('base-init');
                return { baseMethod() { log.push('base-method'); } };
            }
            function Derived(unit: Unit) {
                log.push('derived-init-start');
                xnew.extend(Base);
                log.push('derived-init-end');
                return {
                    derivedMethod() {
                        log.push('derived-method');
                        (unit as any).baseMethod();
                    },
                };
            }

            const unit = xnew(Derived) as any;
            unit.derivedMethod();

            expect(log).toEqual([
                'derived-init-start',
                'base-init',
                'derived-init-end',
                'derived-method',
                'base-method',
            ]);
        });
    });

    describe('errors', () => {
        it('throws when extend is called after initialization', () => {
            // xnew.extend logs via console.error before re-throwing; silence it here.
            const error = jest.spyOn(console, 'error').mockImplementation(() => {});
            function Base(_: Unit) { return {}; }
            let deferredExtend!: () => void;
            try {
                // Capture the call site, then run it after the component has finished
                // initializing (state is no longer 'invoked') to hit the guard.
                xnew(() => {
                    deferredExtend = xnew.scope(() => xnew.extend(Base));
                });

                expect(() => deferredExtend()).toThrow('xnew.extend can not be called after initialized.');
            } finally {
                error.mockRestore();
            }
        });

        it('warns when the same component is extended twice', () => {
            const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
            function Base(_: Unit) { return {}; }
            try {
                xnew(() => {
                    xnew.extend(Base);
                    xnew.extend(Base);
                });
                expect(warn).toHaveBeenCalledWith('Component is already extended in this unit:', Base);
            } finally {
                warn.mockRestore();
            }
        });
    });
});
