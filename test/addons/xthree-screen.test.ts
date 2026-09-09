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
// xthree.project / xthree.Pin — 3D の点を画面（canvas に対する割合）へ落とし、そこへ DOM を置く。
//   置くところは xbasics.Pin の担当（test/basics/stage/Pin.test.ts）なので、ここで見るのは
//   投影そのものと、その結果が Pin へ渡っていることだけ。
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

    it('Pin: 投影した割合がそのまま left / top に届く', () => {
        let pin;

        inScene(() => { pin = xnew(xthree.Pin, { point: () => new THREE.Vector3(0, 0, -3) }); });

        expect(parseFloat(pin.current.style.left)).toBeCloseTo(50);
        expect(parseFloat(pin.current.style.top)).toBeCloseTo(50);
        expect(pin.current.style.visibility).toBe('visible');
    });

    it('Pin: カメラの後ろの点は置けないので隠れる', () => {
        let pin;

        inScene(() => { pin = xnew(xthree.Pin, { point: () => new THREE.Vector3(0, 0, 3) }); });

        expect(pin.current.style.visibility).toBe('hidden');
    });

    it('Pin: 点が動けば毎フレーム付いていく', () => {
        const target = new THREE.Vector3(0, 0, -3);
        let pin;

        inScene(() => { pin = xnew(xthree.Pin, { point: () => target }); });
        expect(parseFloat(pin.current.style.left)).toBeCloseTo(50);

        target.x = 1.2426;   // 距離 3 での視野の右端
        jest.advanceTimersByTime(50);

        expect(parseFloat(pin.current.style.left)).toBeCloseTo(100, 0);
    });
});
