// @ts-nocheck
import { Unit } from '../../../src/core/unit';
import { xnew, xbasics } from '../../../src/index';

//----------------------------------------------------------------------------------------------------
// xbasics.Pin — 枠に対する割合で来た点へ DOM を置く。投影は呼ぶ側（xthree / xpixi）の仕事なので、
//   ここは three も pixi も要らず、割合と DOM の算数だけを見る。
//   点が枠の上へ外れたときは、枠の中央へ向かって降り、収まるところで止まる。
//----------------------------------------------------------------------------------------------------

describe('xbasics.Pin', () => {
    beforeEach(() => {
        // jsdom に ResizeObserver は無い。Pin は自分の大きさを測り直すためだけに使う
        global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
        jest.useFakeTimers();
        Unit.reset();
    });
    afterEach(() => {
        Unit.engineRoot?.destroy();
        jest.useRealTimers();
    });

    it('渡された割合をそのまま left / top に書く', () => {
        const pin = xnew(xbasics.Pin, { point: () => ({ x: 0.5, y: 0.5 }) });

        expect(parseFloat(pin.current.style.left)).toBeCloseTo(50);
        expect(parseFloat(pin.current.style.top)).toBeCloseTo(50);
        expect(pin.current.style.visibility).toBe('visible');
    });

    it('点が出せないうちは消さずに隠す（大きさを測り続けられるように）', () => {
        const pin = xnew(xbasics.Pin, { point: () => null });

        expect(pin.current.style.visibility).toBe('hidden');
        expect(pin.current.isConnected).toBe(true);
    });

    it('枠の上へ外れた点は、枠の中央へ向かって収まるところまで降りる', () => {
        // jsdom にレイアウトが無いので要素の高さは 0。gap のぶんだけ枠の中へ入れば足りる
        const above = xnew(xbasics.Pin, { point: () => ({ x: 0, y: -1 }), gap: 0.1 });

        // 上端の外 (0, -1) から中央 (0.5, 0.5) への線を、上端から gap のところまで降りる
        expect(parseFloat(above.current.style.top)).toBeCloseTo(0);
        // 縦に降りたぶんだけ横も中央へ寄る（(-1 → 0.1) は道のり 1.5 のうち 1.1）
        expect(parseFloat(above.current.style.left)).toBeCloseTo(0.5 * (1.1 / 1.5) * 100);
    });

    it('枠の中に収まっている点は動かさない', () => {
        const inside = xnew(xbasics.Pin, { point: () => ({ x: 0.2, y: 0.8 }), gap: 0.1 });

        expect(parseFloat(inside.current.style.left)).toBeCloseTo(20);
        expect(parseFloat(inside.current.style.top)).toBeCloseTo(70);   // gap のぶんだけ上
    });

    // fit: 'cover' の再現。800x400 の箱に、canvas が 800x800 で上下 200 ずつはみ出している
    it('frame を渡すと、その枠の割合を自分の箱の割合へ引き直す', () => {
        const frame = document.createElement('canvas');

        frame.getBoundingClientRect = () => ({ left: 0, top: -200, width: 800, height: 800 }) as DOMRect;

        function place(frame?: HTMLElement): string {
            let pin!: xnew.Unit;

            xnew(() => {
                const host = xnew.nest({ tag: 'div' }) as HTMLElement;

                Object.defineProperty(host, 'clientWidth', { value: 800 });
                Object.defineProperty(host, 'clientHeight', { value: 400 });
                host.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 400 }) as DOMRect;

                pin = xnew(xbasics.Pin, { point: () => ({ x: 0.5, y: 0.25 }), frame });
            });
            return (pin.current as HTMLElement).style.top;
        }

        // frame 無し = 恒等写像。枠の 25% をそのまま箱の 25% として書く
        expect(parseFloat(place())).toBeCloseTo(25);

        // frame 有り = canvas の 25%（= canvas 上端から 200px、箱の上端ちょうど）へ引き直す
        expect(parseFloat(place(frame))).toBeCloseTo(0);
    });

    it('点が動けば毎フレーム付いていく', () => {
        const target = { x: 0.5, y: 0.5 };
        const pin = xnew(xbasics.Pin, { point: () => target });

        expect(parseFloat(pin.current.style.left)).toBeCloseTo(50);

        target.x = 1.0;
        jest.advanceTimersByTime(50);

        expect(parseFloat(pin.current.style.left)).toBeCloseTo(100, 0);
    });
});
