import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';
import { Screen } from '../../../src/basics/stage/Screen';

//----------------------------------------------------------------------------------------------------
// Screen — 固定解像度の canvas を親の箱に合わせる。nest が決めるのは「後から足す DOM がどの箱に入るか」
//   だけで、canvas の居場所（Aspect の枠の中）はどちらでも変わらない。
//   jsdom はレイアウトを持たないので、確かめられるのは木の形と属性とインライン style まで。
//----------------------------------------------------------------------------------------------------

describe('basics Screen', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        Unit.reset();
    });
    afterEach(() => {
        Unit.engineRoot?.destroy();
        jest.useRealTimers();
    });

    // 呼び出し側が自分の箱を用意して extend する、Screen の実際の使われ方
    function mount(props: any): { screen: any, after: xnew.Unit, host: HTMLElement } {
        let screen!: any;
        let after!: xnew.Unit;
        let host!: HTMLElement;

        xnew(() => {
            host = xnew.nest({ tag: 'div' }) as HTMLElement;
            screen = xnew.extend(Screen, props);
            after = xnew({ tag: 'span' });
        });
        return { screen, after, host };
    }

    it('puts what follows in the canvas box by default', () => {
        const { screen, after, host } = mount({ width: 100, height: 100 });

        expect(after.current.parentElement).toBe(screen.canvas.parentElement);
        expect(host.contains(screen.canvas)).toBe(true);
    });

    it('nest: false leaves what follows on the host, with the canvas still in its own box', () => {
        const { screen, after, host } = mount({ width: 100, height: 100, nest: false });

        expect(after.current.parentElement).toBe(host);
        expect(screen.canvas.parentElement).not.toBe(host);
        expect(host.contains(screen.canvas)).toBe(true);
    });

    it('hands back the canvas at the buffer resolution either way', () => {
        [true, false].forEach((nest) => {
            const { screen } = mount({ width: 320, height: 240, nest });

            expect(screen.canvas.tagName.toLowerCase()).toBe('canvas');
            expect(screen.canvas.width).toBe(320);
            expect(screen.canvas.height).toBe(240);
        });
    });

    // 枠の width は min() / max() で書かれるが jsdom の CSSOM が落とすので、残る 2 つで見る
    it('passes the aspect and the fit through to the aspect box either way', () => {
        [true, false].forEach((nest) => {
            const contain = mount({ width: 200, height: 100, fit: 'contain', nest });
            const cover = mount({ width: 200, height: 100, fit: 'cover', nest });
            const box = (mounted: any): HTMLElement => mounted.screen.canvas.parentElement as HTMLElement;

            expect(box(contain).style.aspectRatio).toBe('2');
            expect(box(cover).style.aspectRatio).toBe('2');

            // 外箱を覆う側だけが縮まないように留められる
            expect(box(contain).style.flexShrink).toBe('');
            expect(box(cover).style.flexShrink).toBe('0');
        });
    });
});
