import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';

describe('Unit lifecycle', () => {
    beforeEach(() => {
        jest.useFakeTimers({ now: 0 });
        Unit.reset();
    });
    afterEach(() => {
        Unit.engineRoot?.destroy();
        jest.useRealTimers();
    });

    it('emits destroy exactly once even when destroyed twice', () => {
        const onDestroy = jest.fn();
        const unit = xnew((u: Unit) => u.on('destroy', onDestroy));
        unit.destroy();
        unit.destroy();
        expect(onDestroy).toHaveBeenCalledTimes(1);
    });

    it('runs update listeners once the unit is active', async () => {
        const onUpdate = jest.fn();
        xnew((u: Unit) => u.on('update', onUpdate));
        expect(onUpdate).not.toHaveBeenCalled();
        await jest.advanceTimersByTimeAsync(50);
        expect(onUpdate).toHaveBeenCalled();
    });

    it('stops running update listeners after destroy', async () => {
        const onUpdate = jest.fn();
        const unit = xnew((u: Unit) => u.on('update', onUpdate));
        await jest.advanceTimersByTimeAsync(40);
        const calledBefore = onUpdate.mock.calls.length;
        expect(calledBefore).toBeGreaterThan(0);
        unit.destroy();
        await jest.advanceTimersByTimeAsync(40);
        expect(onUpdate).toHaveBeenCalledTimes(calledBefore);
    });

    it('passes an incrementing per-listener count and numeric delta to update listeners', async () => {
        const calls: Array<{ count: number, delta: number }> = [];
        xnew((u: Unit) => u.on('update', ({ count, delta }: any) => calls.push({ count, delta })));
        await jest.advanceTimersByTimeAsync(100);
        expect(calls.length).toBeGreaterThan(1);
        calls.forEach((c, i) => {
            expect(c.count).toBe(i); // リスナが呼ばれるたび 0 始まりで 1 ずつ増える
            expect(typeof c.delta).toBe('number');
            expect(c.delta).toBeGreaterThan(0);
        });
    });

    it('counts per listener — a listener added later starts its own count at 0', async () => {
        const a: number[] = [];
        const b: number[] = [];
        xnew((u: Unit) => {
            u.on('update', ({ count }: any) => {
                a.push(count);
                // 同じ unit でも、後から登録したリスナは独立に 0 から数える。
                if (count === 2) u.on('update', ({ count }: any) => b.push(count));
            });
        });
        await jest.advanceTimersByTimeAsync(120);

        expect(a[0]).toBe(0);
        expect(b[0]).toBe(0); // A が count===2 まで進んでいても B は 0 から
        expect(a.at(-1)!).toBeGreaterThan(b.at(-1)!); // 先に登録した A の方が多く呼ばれている
    });

    it('counts per unit — a later unit starts its own count at 0', async () => {
        const a: number[] = [];
        xnew((u: Unit) => u.on('update', ({ count }: any) => a.push(count)));
        await jest.advanceTimersByTimeAsync(80);
        const aBeforeB = a.at(-1)!;

        const b: number[] = [];
        xnew((u: Unit) => u.on('update', ({ count }: any) => b.push(count)));
        await jest.advanceTimersByTimeAsync(80);

        expect(b[0]).toBe(0); // B の最初の update は 0（グローバルカウンタではない）
        expect(a.at(-1)!).toBeGreaterThan(aBeforeB); // A は独立に増え続ける
    });
});
