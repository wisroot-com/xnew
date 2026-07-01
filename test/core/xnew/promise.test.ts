import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';

describe('xnew promise helpers', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        Unit.reset();
    });
    afterEach(() => {
        Unit.engineRoot?.finalize();
        jest.useRealTimers();
    });

    describe('xnew.promise(unit).then', () => {
        it('runs once after all registered promises resolve', async () => {
            const done = jest.fn();
            xnew((unit) => {
                xnew.promise(Promise.resolve(1));
                xnew.promise(Promise.resolve(2));
                xnew.promise(unit).then(done);
            });

            await jest.advanceTimersByTimeAsync(0);

            expect(done).toHaveBeenCalledTimes(1);
        });

        it('does not run until the slowest registered promise resolves', async () => {
            const done = jest.fn();
            xnew((unit) => {
                xnew.promise(Promise.resolve('fast'));
                xnew.promise(new Promise((resolve) => setTimeout(() => resolve('slow'), 100)));
                xnew.promise(unit).then(done);
            });

            await jest.advanceTimersByTimeAsync(0);
            expect(done).not.toHaveBeenCalled();

            await jest.advanceTimersByTimeAsync(100);
            expect(done).toHaveBeenCalledTimes(1);
        });

        it('awaits keyless promises but omits their values from the aggregate', async () => {
            const done = jest.fn();
            xnew((unit) => {
                xnew.promise(Promise.resolve(1));
                xnew.promise(unit).then(done);
            });

            await jest.advanceTimersByTimeAsync(0);

            // then always receives an object; keyless values are awaited but never surfaced
            expect(done).toHaveBeenCalledTimes(1);
            expect(done).toHaveBeenCalledWith({});
        });
    });

    describe('xnew.promise(unit).then — returned promise', () => {
        it('waits for a promise returned from the callback before completing', async () => {
            // .then の callback が return した promise の解決まで、後続 / 親の完了が待たれる。
            const onDone = jest.fn();
            let release!: () => void;
            const unit = xnew((u) => {
                xnew.promise(Promise.resolve(1));
                xnew.promise(u).then(() => new Promise<void>((resolve) => { release = resolve; }));
            });
            // 外から完了を観測（このスナップショットに「.then の完了」が同期登録されている前提）。
            xnew.promise(unit).then(onDone);

            await jest.advanceTimersByTimeAsync(0);
            expect(onDone).not.toHaveBeenCalled(); // return した promise が未解決 → 完了しない

            release();
            await jest.advanceTimersByTimeAsync(0);
            expect(onDone).toHaveBeenCalledTimes(1);
        });

        it('serializes: a later xnew.promise(unit).then waits for an earlier one to settle', async () => {
            const order: string[] = [];
            let releaseFirst!: () => void;
            xnew((u) => {
                xnew.promise(u).then(() => new Promise<void>((resolve) => {
                    releaseFirst = () => { order.push('first'); resolve(); };
                }));
                xnew.promise(u).then(() => { order.push('second'); });
            });

            await jest.advanceTimersByTimeAsync(0);
            expect(order).toEqual([]); // first がまだ解決していない → second も走らない

            releaseFirst();
            await jest.advanceTimersByTimeAsync(0);
            expect(order).toEqual(['first', 'second']);
        });

        it('completes when the callback returns a non-promise value', async () => {
            const onDone = jest.fn();
            const unit = xnew((u) => {
                xnew.promise(Promise.resolve(1));
                xnew.promise(u).then(() => { /* 非 promise を返す → cb 終了が完了 */ });
            });
            xnew.promise(unit).then(onDone);

            await jest.advanceTimersByTimeAsync(0);
            expect(onDone).toHaveBeenCalledTimes(1);
        });

        it('a parent waiting on the child (xnew.promise(child)) waits for a promise returned inside the child', async () => {
            // tohoku_shot のパターン: 子の xnew.promise(unit).then が return した promise（bake）を、
            // 親が xnew.promise(child) 経由で待つ。.then が書き換えたハンドルが子の _.promises に
            // 同期登録されているため、親のスナップショットに含まれる。
            const parentDone = jest.fn();
            let release!: () => void;
            function Child(u: Unit) {
                xnew.promise(Promise.resolve(1)); // load
                xnew.promise(u).then(() => new Promise<void>((resolve) => { release = resolve; })); // bake
            }
            xnew((p) => {
                xnew.promise(xnew(Child)); // 親は子 unit の完了を待つ
                xnew.promise(p).then(parentDone);
            });

            await jest.advanceTimersByTimeAsync(0);
            expect(parentDone).not.toHaveBeenCalled(); // 子の bake 未完 → 親も未完

            release();
            await jest.advanceTimersByTimeAsync(0);
            expect(parentDone).toHaveBeenCalledTimes(1);
        });
    });

    describe('xnew.promise(unit).catch', () => {
        it('runs with the rejection reason when a registered promise rejects', async () => {
            const caught = jest.fn();
            xnew((unit) => {
                xnew.promise(Promise.resolve('ok'));
                xnew.promise(Promise.reject('boom'));
                xnew.promise(unit).catch(caught);
            });

            await jest.advanceTimersByTimeAsync(0);

            expect(caught).toHaveBeenCalledTimes(1);
            expect(caught).toHaveBeenCalledWith('boom');
        });

        it('does not run when every registered promise resolves', async () => {
            const caught = jest.fn();
            xnew((unit) => {
                xnew.promise(Promise.resolve(1));
                xnew.promise(Promise.resolve(2));
                xnew.promise(unit).catch(caught);
            });

            await jest.advanceTimersByTimeAsync(0);

            expect(caught).not.toHaveBeenCalled();
        });
    });

    describe('xnew.promise(unit).finally', () => {
        it('runs after all registered promises resolve', async () => {
            const onFinally = jest.fn();
            xnew((unit) => {
                xnew.promise(Promise.resolve(1));
                xnew.promise(Promise.resolve(2));
                xnew.promise(unit).finally(onFinally);
            });

            await jest.advanceTimersByTimeAsync(0);

            expect(onFinally).toHaveBeenCalledTimes(1);
        });

        it('runs after a registered promise rejects', async () => {
            const onFinally = jest.fn();
            xnew((unit) => {
                xnew.promise(Promise.reject('boom'));
                // attach a catch so the rejection is handled and never surfaces as unhandled
                xnew.promise(unit).finally(onFinally).catch(() => {});
            });

            await jest.advanceTimersByTimeAsync(0);

            expect(onFinally).toHaveBeenCalledTimes(1);
        });
    });

    describe('xnew.promise (deferred mode)', () => {
        it('returns a settle handle and resolves via resolve()', async () => {
            const done = jest.fn();
            let defer!: { resolve: (value?: unknown) => void; reject: (reason?: unknown) => void };
            xnew((unit) => {
                defer = xnew.promise();
                xnew.promise(unit).then(done);
            });

            await jest.advanceTimersByTimeAsync(0);
            expect(done).not.toHaveBeenCalled();

            defer.resolve();
            await jest.advanceTimersByTimeAsync(0);

            expect(done).toHaveBeenCalledTimes(1);
        });

        it('ignores subsequent settle calls (idempotent)', async () => {
            const done = jest.fn();
            const caught = jest.fn();
            let defer!: { resolve: (value?: unknown) => void; reject: (reason?: unknown) => void };
            xnew((unit) => {
                defer = xnew.promise();
                xnew.promise(unit).then(done);
                xnew.promise(unit).catch(caught);
            });

            defer.resolve();
            // a later reject after the first settle must be a no-op
            defer.reject();
            await jest.advanceTimersByTimeAsync(0);

            expect(done).toHaveBeenCalledTimes(1);
            expect(caught).not.toHaveBeenCalled();
        });

        it('passes a keyed deferred value to then under its key', async () => {
            const done = jest.fn();
            let defer!: { resolve: (value?: unknown) => void; reject: (reason?: unknown) => void };
            xnew((unit) => {
                defer = xnew.promise('ready');
                xnew.promise(unit).then(done);
            });

            await jest.advanceTimersByTimeAsync(0);
            expect(done).not.toHaveBeenCalled();

            defer.resolve(42);
            await jest.advanceTimersByTimeAsync(0);

            expect(done).toHaveBeenCalledWith({ ready: 42 });
        });

        it('awaits a keyless deferred but omits its value from the aggregate', async () => {
            const done = jest.fn();
            let defer!: { resolve: (value?: unknown) => void; reject: (reason?: unknown) => void };
            xnew((unit) => {
                defer = xnew.promise();
                xnew.promise(unit).then(done);
            });

            defer.resolve('kept');
            await jest.advanceTimersByTimeAsync(0);

            expect(done).toHaveBeenCalledWith({});
        });

        it('rejects via reject() and triggers xnew.promise(unit).catch', async () => {
            const caught = jest.fn();
            let defer!: { resolve: (value?: unknown) => void; reject: (reason?: unknown) => void };
            xnew((unit) => {
                defer = xnew.promise();
                xnew.promise(unit).catch(caught);
            });

            defer.reject('boom');
            await jest.advanceTimersByTimeAsync(0);

            expect(caught).toHaveBeenCalledTimes(1);
            expect(caught).toHaveBeenCalledWith('boom');
        });

        it('throws when called with two arguments but the promise is undefined (runtime misuse)', () => {
            // The overloads reject this at compile time; cast to exercise the runtime guard
            // for dynamic callers whose promise variable is undefined at runtime.
            expect(() => {
                xnew(() => {
                    (xnew.promise as (key: string, promise: unknown) => unknown)('key', undefined);
                });
            }).toThrow();
        });
    });

    describe('promise-rules.md trace (A〜E)', () => {
        it('C waits for A,B; E waits for A,B,C(returned); E receives key1,key2,key3 in the parent scope', async () => {
            const order: string[] = [];
            let releaseA!: () => void;
            let releaseB!: () => void;
            let releaseD!: () => void;

            function Child(unit: Unit) {
                const a = xnew.promise('key1'); releaseA = () => a.resolve(1); // A
                const b = xnew.promise('key2'); releaseB = () => b.resolve(2); // B
                xnew.promise('key3', unit).then(({ key1, key2 }: any) => {     // C
                    order.push(`C:${key1},${key2}`);
                    // D は return した promise として表す（同期登録は NG）。
                    return new Promise<string>((resolve) => { releaseD = () => resolve('done'); });
                });
            }
            const seen: any[] = [];
            xnew((parent: Unit) => {
                const child = xnew(Child);
                xnew.promise(child).then((results: any) => {                    // E
                    seen.push(results);
                    order.push(`E:key3=${results.key3},hasKey1=${'key1' in results},parentScope=${Unit.currentUnit === parent}`);
                });
            });

            await jest.advanceTimersByTimeAsync(0);
            expect(order).toEqual([]); // A,B 未解決 → C も E も走らない

            releaseA();
            releaseB();
            await jest.advanceTimersByTimeAsync(0);
            expect(order).toEqual(['C:1,2']); // C 開始。E は C の return 待ちでまだ

            releaseD();
            await jest.advanceTimersByTimeAsync(0);
            // E 開始: プールは消費されないので key1/key2 も残っており、key3 = C の戻り値、Parent スコープ。
            expect(order).toEqual(['C:1,2', 'E:key3=done,hasKey1=true,parentScope=true']);
            expect(seen[0]).toEqual({ key1: 1, key2: 2, key3: 'done' });
        });
    });

    describe('xnew.promise — keyless values are omitted from the aggregate', () => {
        it('awaits keyless promises but leaves them out of the result object', async () => {
            const done = jest.fn();
            xnew((unit) => {
                xnew.promise(Promise.resolve('a'));
                xnew.promise(Promise.resolve('b'));
                xnew.promise(unit).then(done);
            });

            await jest.advanceTimersByTimeAsync(0);

            expect(done).toHaveBeenCalledWith({});
        });

        it('keeps only keyed props when keyed and keyless are mixed', async () => {
            const done = jest.fn();
            xnew((unit) => {
                xnew.promise('a', Promise.resolve(1));
                xnew.promise(Promise.resolve('kept'));
                xnew.promise(unit).then(done);
            });

            await jest.advanceTimersByTimeAsync(0);

            expect(done).toHaveBeenCalledWith({ a: 1 });
        });

        it('returns {} when the unit has no keyed promises', async () => {
            const done = jest.fn();
            const unit = xnew(() => {});
            xnew.promise(unit).then(done);

            await jest.advanceTimersByTimeAsync(0);

            expect(done).toHaveBeenCalledWith({});
        });

        it('nests a keyless child aggregate as an empty object under its key', async () => {
            const done = jest.fn();
            xnew((unit) => {
                const child = xnew(() => {
                    xnew.promise(Promise.resolve(1));
                    xnew.promise(Promise.resolve(2));
                });
                xnew.promise('child', child);
                xnew.promise(unit).then(done);
            });

            await jest.advanceTimersByTimeAsync(0);

            expect(done).toHaveBeenCalledWith({ child: {} });
        });
    });

    describe('xnew.promise(unit) — does not consume the pool', () => {
        it('lets the same unit be aggregated twice with the same result', async () => {
            const first = jest.fn();
            const second = jest.fn();
            const unit = xnew(() => {
                xnew.promise('a', Promise.resolve(1));
                xnew.promise('b', Promise.resolve(2));
            });
            xnew.promise(unit).then(first);
            xnew.promise(unit).then(second);

            await jest.advanceTimersByTimeAsync(0);

            expect(first).toHaveBeenCalledWith({ a: 1, b: 2 });
            expect(second).toHaveBeenCalledWith({ a: 1, b: 2 });
        });
    });

    describe('keyed xnew.promise', () => {
        it('passes keyed promise values to then under their key', async () => {
            const done = jest.fn();
            xnew((unit) => {
                xnew.promise('a', Promise.resolve(1));
                xnew.promise('b', Promise.resolve(2));
                xnew.promise(unit).then(done);
            });

            await jest.advanceTimersByTimeAsync(0);

            expect(done).toHaveBeenCalledWith({ a: 1, b: 2 });
        });

        it('omits keyless promises while keeping keyed props', async () => {
            const done = jest.fn();
            xnew((unit) => {
                xnew.promise('a', Promise.resolve(1));
                xnew.promise(Promise.resolve('kept'));
                xnew.promise(unit).then(done);
            });

            await jest.advanceTimersByTimeAsync(0);

            expect(done).toHaveBeenCalledWith({ a: 1 });
        });

        it('binds the key to the final value of a then-chain', async () => {
            const done = jest.fn();
            xnew((unit) => {
                xnew.promise('a', Promise.resolve(1)).then((v: number) => v + 10).then((v: number) => v * 2);
                xnew.promise(unit).then(done);
            });

            await jest.advanceTimersByTimeAsync(0);

            expect(done).toHaveBeenCalledWith({ a: 22 });
        });

        it('lets a later duplicate key win', async () => {
            const done = jest.fn();
            xnew((unit) => {
                xnew.promise('a', Promise.resolve('first'));
                xnew.promise('a', Promise.resolve('second'));
                xnew.promise(unit).then(done);
            });

            await jest.advanceTimersByTimeAsync(0);

            expect(done).toHaveBeenCalledWith({ a: 'second' });
        });

        it('collects a child unit keyed results when registered with a key', async () => {
            const done = jest.fn();
            xnew((unit) => {
                const child = xnew(() => {
                    xnew.promise('x', Promise.resolve(7));
                });
                xnew.promise('child', child);
                xnew.promise(unit).then(done);
            });

            await jest.advanceTimersByTimeAsync(0);

            expect(done).toHaveBeenCalledWith({ child: { x: 7 } });
        });

        it('can be awaited from outside the component via the returned unit', async () => {
            const done = jest.fn();
            const unit = xnew(() => {
                xnew.promise('x', Promise.resolve(7));
            });
            xnew.promise(unit).then(done);

            await jest.advanceTimersByTimeAsync(0);

            expect(done).toHaveBeenCalledWith({ x: 7 });
        });

        it('does not run the then callback when a keyed promise rejects', async () => {
            const done = jest.fn();
            xnew((unit) => {
                xnew.promise('a', Promise.reject('boom'));
                // attach catch handlers so the rejection never surfaces as unhandled
                xnew.promise(unit).then(done).catch(() => {});
                xnew.promise(unit).catch(() => {});
            });

            await jest.advanceTimersByTimeAsync(0);

            expect(done).not.toHaveBeenCalled();
        });
    });

    describe('xnew.promise — append keys (name[])', () => {
        it('aggregates name[] keys into an array in registration order', async () => {
            const got = jest.fn();
            xnew((u) => {
                xnew.promise('vrms[]', Promise.resolve('a'));
                xnew.promise('vrms[]', Promise.resolve('b'));
                xnew.promise(u).then(got);
            });

            await jest.advanceTimersByTimeAsync(0);

            expect(got).toHaveBeenCalledWith({ vrms: ['a', 'b'] });
        });

        it('orders by registration, not by resolution timing', async () => {
            const got = jest.fn();
            let resolveFirst!: (v: unknown) => void;
            xnew((u) => {
                xnew.promise('vrms[]', new Promise((res) => { resolveFirst = res; }));
                xnew.promise('vrms[]', Promise.resolve('b'));
                xnew.promise(u).then(got);
            });

            await jest.advanceTimersByTimeAsync(0);
            resolveFirst('a'); // 後から解決しても 0 番目に入る
            await jest.advanceTimersByTimeAsync(0);

            expect(got).toHaveBeenCalledWith({ vrms: ['a', 'b'] });
        });

        it('keeps plain keys flat alongside append keys', async () => {
            const got = jest.fn();
            xnew((u) => {
                xnew.promise('vrms[]', Promise.resolve('a'));
                xnew.promise('ready', Promise.resolve(1));
                xnew.promise(u).then(got);
            });

            await jest.advanceTimersByTimeAsync(0);

            expect(got).toHaveBeenCalledWith({ vrms: ['a'], ready: 1 });
        });

        it('rejects the old indexed key form (name[index])', () => {
            expect(() => {
                xnew(() => {
                    xnew.promise('vrms[0]', Promise.resolve('a'));
                });
            }).toThrow(/vrms\[\]/);
        });
    });
});
