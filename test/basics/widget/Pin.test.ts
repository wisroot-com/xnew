// @ts-nocheck
import { Unit } from '../../../src/core/unit';
import { xnew, xbasics } from '../../../src/index';

//----------------------------------------------------------------------------------------------------
// xbasics.Pin — 枠に対する割合で来た点へ DOM を置く。投影は呼ぶ側（xthree / xpixi）の仕事なので、
//   ここは three も pixi も要らず、割合と DOM の算数だけを見る。
//   点が枠の上へ外れたときは toward の方へ線を下って枠の中に入るところまで降ろす。
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

        expect(pin.current.style.left).toBe('50%');
        expect(pin.current.style.top).toBe('50%');
        expect(pin.current.style.visibility).toBe('visible');
    });

    it('点が出せないうちは消さずに隠す（大きさを測り続けられるように）', () => {
        const pin = xnew(xbasics.Pin, { point: () => null });

        expect(pin.current.style.visibility).toBe('hidden');
        expect(pin.current.isConnected).toBe(true);
    });

    it('枠の上へ外れた点は、toward の方へ降りて margin のところで止まる', () => {
        const above = () => ({ x: 0.5, y: -0.5 });   // 枠の上へ外れた点
        const below = () => ({ x: 0.5, y: 0.5 });    // 同じ物の足元（枠の中央）

        const alone = xnew(xbasics.Pin, { point: above, margin: 0.3 });
        const slid = xnew(xbasics.Pin, { point: above, toward: below, margin: 0.3 });

        // toward が無ければ枠の外に置かれたまま
        expect(parseFloat(alone.current.style.top)).toBeLessThan(0);
        // toward があれば、頭と足を結ぶ線を下って margin のところまで降りる
        expect(parseFloat(slid.current.style.top)).toBeCloseTo(30);
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

        expect(pin.current.style.left).toBe('50%');

        target.x = 1.0;
        jest.advanceTimersByTime(50);

        expect(parseFloat(pin.current.style.left)).toBeCloseTo(100, 0);
    });
});
