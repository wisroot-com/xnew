// @ts-nocheck
import { Unit } from '../../../src/core/unit';
import { xnew, xbasics } from '../../../src/index';

//----------------------------------------------------------------------------------------------------
// xbasics.Plane — 視点から見た行列で来た置き場へ DOM を寝かせる。見るところまでが呼ぶ側（xthree）の
//   仕事なので、ここは three も要らず、CSS の射影に直す算数だけを見る。
//   1 単位 = 枠の 1 CSS ピクセル。その換算を決めるのが枠の高さと fov。
//----------------------------------------------------------------------------------------------------

describe('xbasics.Plane', () => {
    beforeEach(() => {
        // jsdom に ResizeObserver は無い。Plane は枠を測り直すためだけに使う
        global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
        jest.useFakeTimers();
        Unit.reset();
    });
    afterEach(() => {
        Unit.engineRoot?.destroy();
        jest.useRealTimers();
    });

    // jsdom にレイアウトが無いので、枠になる箱の大きさは自分で持たせる
    function inBox(build: () => void, size = { width: 800, height: 400 }): void {
        xnew(() => {
            const host = xnew.nest({ tag: 'div' }) as HTMLElement;

            Object.defineProperty(host, 'clientWidth', { value: size.width });
            Object.defineProperty(host, 'clientHeight', { value: size.height });
            host.getBoundingClientRect = () => ({ left: 0, top: 0, width: size.width, height: size.height }) as DOMRect;

            build();
        });
    }

    // 列優先 16 個。回転無しで (tx, ty, tz) だけ動かした置き場
    function at(tx: number, ty: number, tz: number): number[] {
        return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, tx, ty, tz, 1];
    }

    function numbers(transform: string): number[] {
        return transform.match(/matrix3d\(([^)]*)\)/)![1].split(',').map(Number);
    }

    it('視野角と枠の高さから視点までの距離を出し、その距離を perspective に書く', () => {
        let plane!: xnew.Unit;

        // 高さ 400 で fov 90 度なら、視点は枠から 200 のところ（tan(45°) = 1）
        inBox(() => {
            plane = xnew(xbasics.Plane, { view: () => ({ matrix: at(0, 0, -500), fov: 90 }) });
        });

        expect(plane.current.style.visibility).toBe('visible');
        expect(plane.current.style.transform).toContain('perspective(200.000000px)');
        expect(plane.current.style.transform).toContain('translateZ(200.000000px)');
        // 原点は枠の中央。そこが消失点になる
        expect(parseFloat(plane.current.style.left)).toBeCloseTo(50);
        expect(parseFloat(plane.current.style.top)).toBeCloseTo(50);
    });

    it('CSS は y が下向きなので、行列の y だけ符号が返る', () => {
        let plane!: xnew.Unit;

        inBox(() => {
            plane = xnew(xbasics.Plane, { view: () => ({ matrix: at(30, 100, -500), fov: 90 }) });
        });

        const elements = numbers(plane.current.style.transform);

        expect(elements[12]).toBeCloseTo(30);     // x はそのまま
        expect(elements[13]).toBeCloseTo(-100);   // y は反転
        expect(elements[14]).toBeCloseTo(-500);   // z もそのまま
    });

    it('行列が回転を持つときは、y の行と列だけが返り、その交点は返らない', () => {
        let plane!: xnew.Unit;

        // x 軸まわり 90 度。y 軸と z 軸が入れ替わる
        inBox(() => {
            plane = xnew(xbasics.Plane, { view: () => ({ matrix: [1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, -500, 1], fov: 90 }) });
        });

        const elements = numbers(plane.current.style.transform);

        expect(elements[5]).toBeCloseTo(0);    // 交点（行 1 × 列 1）は二度返るので元のまま
        expect(elements[6]).toBeCloseTo(-1);   // 列 1
        expect(elements[9]).toBeCloseTo(1);    // 行 1
    });

    // ここが崩れると three の絵と DOM が静かにずれる。板の中央が画面のどこへ落ちるかを、CSS の順に辿って確かめる
    it('板の中央は、カメラと同じ式で画面へ落ちる（枠の中央から x * 視点距離 / 奥行き ピクセル）', () => {
        let plane!: xnew.Unit;

        inBox(() => {
            plane = xnew(xbasics.Plane, { view: () => ({ matrix: at(100, 50, -500), fov: 90 }) });
        });

        const transform = plane.current.style.transform;
        const eye = parseFloat(transform.match(/perspective\(([^p]*)px\)/)![1]);
        const elements = numbers(transform);

        // translate(-50%, -50%) で中央が原点へ来て、matrix3d が置き場へ運び、translateZ が視点の分だけ押す
        const [x, y, z] = [elements[12], elements[13], elements[14] + eye];
        // perspective() の同次除算
        const w = 1 - z / eye;

        expect(x / w).toBeCloseTo(100 * eye / 500);    // 枠の中央から右へ
        expect(y / w).toBeCloseTo(-50 * eye / 500);    // 上へ（CSS の y は下向きなので負）
    });

    it('置き場が出せないうちは消さずに隠す（枠を測り続けられるように）', () => {
        let plane!: xnew.Unit;

        inBox(() => {
            plane = xnew(xbasics.Plane, { view: () => null });
        });

        expect(plane.current.style.visibility).toBe('hidden');
        expect(plane.current.isConnected).toBe(true);
    });

    it('視点の上か後ろにある置き場は隠す（射影が裏返るので）', () => {
        let behind!: xnew.Unit;
        let on!: xnew.Unit;

        inBox(() => {
            behind = xnew(xbasics.Plane, { view: () => ({ matrix: at(0, 0, +100), fov: 90 }) });
            on = xnew(xbasics.Plane, { view: () => ({ matrix: at(0, 0, 0), fov: 90 }) });
        });

        expect(behind.current.style.visibility).toBe('hidden');
        expect(on.current.style.visibility).toBe('hidden');
    });

    // fit: 'cover' の再現。800x400 の箱に、canvas が 800x800 で上下 200 ずつはみ出している
    it('frame を渡すと、その枠の中央を消失点にし、視点までの距離もその枠の高さから出す', () => {
        const frame = document.createElement('canvas');

        frame.getBoundingClientRect = () => ({ left: 0, top: -200, width: 800, height: 800 }) as DOMRect;

        let plane!: xnew.Unit;

        inBox(() => {
            plane = xnew(xbasics.Plane, { view: () => ({ matrix: at(0, 0, -500), fov: 90 }), frame });
        });

        // canvas の中央は箱の上端から 200 のところ = 箱の高さ 400 の 50%
        expect(parseFloat(plane.current.style.left)).toBeCloseTo(50);
        expect(parseFloat(plane.current.style.top)).toBeCloseTo(50);
        // 距離は箱ではなく canvas の高さ 800 から（fov 90 度なので 400）
        expect(plane.current.style.transform).toContain('perspective(400.000000px)');
    });
});
