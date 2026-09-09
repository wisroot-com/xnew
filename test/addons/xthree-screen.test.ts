// @ts-nocheck
import * as THREE from 'three';

// jsdom には WebGL が無いので WebGLRenderer をモックする。
jest.spyOn(THREE, 'WebGLRenderer').mockImplementation(() => ({
    setClearColor() {},
    domElement: { width: 100, height: 100 },
    render() {},
    dispose() {},
    forceContextLoss() {},
    shadowMap: {},
}));

import { Unit } from '../../src/core/unit';
import { xnew } from '../../src/index';
import { xthree } from '../../src/addons/three/xthree';

//----------------------------------------------------------------------------------------------------
// xthree.project / xthree.Pin — 3D の点を画面（枠に対する割合）へ落とし、そこへ DOM を置く。
//   置き場所は「割合」で持つので、canvas が伸び縮みしても同じ場所に留まる。
//   点が枠の上へ外れたときは toward の方へ線を下って枠の中に入るところまで降ろす。
//----------------------------------------------------------------------------------------------------

describe('xthree screen bridge', () => {
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

    // 原点から -z を向く画角 45° の正方形の画面。距離 3 での視野の半分の高さは tan(22.5°) * 3
    function camera() {
        const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
        camera.position.set(0, 0, 0);
        camera.lookAt(0, 0, -1);
        return camera;
    }

    function inScene(body) {
        const canvas = document.createElement('canvas');
        return xnew(() => {
            xthree.init({ canvas, camera: camera() });
            return body();
        });
    }

    it('project: 視線上の点は画面の中央、カメラの後ろは null', () => {
        let center;
        let behind;

        inScene(() => {
            center = xthree.project(new THREE.Vector3(0, 0, -3));
            behind = xthree.project(new THREE.Vector3(0, 0, 3));
        });

        expect(center.x).toBeCloseTo(0.5);
        expect(center.y).toBeCloseTo(0.5);
        expect(behind).toBeNull();
    });

    it('Pin: 投影した点の割合をそのまま left / top に書く', () => {
        let pin;

        inScene(() => { pin = xnew(xthree.Pin, { point: () => new THREE.Vector3(0, 0, -3) }); });

        expect(pin.current.style.left).toBe('50%');
        expect(pin.current.style.top).toBe('50%');
        expect(pin.current.style.visibility).toBe('visible');
    });

    it('Pin: 点が出せないうちは消さずに隠す（大きさを測り続けられるように）', () => {
        let pin;

        inScene(() => { pin = xnew(xthree.Pin, { point: () => null }); });

        expect(pin.current.style.visibility).toBe('hidden');
        expect(pin.current.isConnected).toBe(true);
    });

    it('Pin: 枠の上へ外れた点は、toward の方へ降りて margin のところで止まる', () => {
        const above = () => new THREE.Vector3(0, 2, -3);   // 画面の上へ外れる高さ
        const below = () => new THREE.Vector3(0, 0, -3);   // 同じ物の足元（画面の中央）
        let alone;
        let slid;

        inScene(() => {
            alone = xnew(xthree.Pin, { point: above, margin: 0.3 });
            slid = xnew(xthree.Pin, { point: above, toward: below, margin: 0.3 });
        });

        // toward が無ければ枠の外に置かれたまま
        expect(parseFloat(alone.current.style.top)).toBeLessThan(0);
        // toward があれば、頭と足を結ぶ線を下って margin のところまで降りる
        expect(parseFloat(slid.current.style.top)).toBeCloseTo(30);
    });

    it('Pin: 点が動けば毎フレーム付いていく', () => {
        const target = new THREE.Vector3(0, 0, -3);
        let pin;

        inScene(() => { pin = xnew(xthree.Pin, { point: () => target }); });
        expect(pin.current.style.left).toBe('50%');

        target.x = 1.2426;   // 距離 3 での視野の右端
        jest.advanceTimersByTime(50);

        expect(parseFloat(pin.current.style.left)).toBeCloseTo(100, 0);
    });
});
