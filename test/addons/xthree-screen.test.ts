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
// xthree.project / xthree.view — シーンを画面から見る 2 つ。点は canvas に対する割合へ（xbasics.Pin
//   が取る形）、オブジェクトは視点から見た行列 + fov へ（xbasics.Plane が取る形）。
//   置くところは xbasics 側の担当（test/basics/stage/）なので、ここで見るのは見る計算だけ。
//----------------------------------------------------------------------------------------------------

describe('xthree screen bridge', () => {
    beforeEach(() => {
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
            center = xthree.project(xthree.scene, new THREE.Vector3(0, 0, -3));
            behind = xthree.project(xthree.scene, new THREE.Vector3(0, 0, 3));
        });

        expect(center.x).toBeCloseTo(0.5);
        expect(center.y).toBeCloseTo(0.5);
        expect(behind).toBeNull();
    });

    it('project: 点は object の座標で読む（同じ点でも object が動けば行き先が変わる）', () => {
        let before;
        let after;

        inScene(() => {
            const object = xthree.add(new THREE.Object3D());
            object.position.set(0, 0, -3);

            before = xthree.project(object, new THREE.Vector3(0, 0, 0));
            object.position.x = 1.2426;   // 距離 3 での視野の右端
            after = xthree.project(object, new THREE.Vector3(0, 0, 0));
        });

        expect(before.x).toBeCloseTo(0.5);
        // 動かした直後でも、そのフレームの位置で読める（localToWorld が行列を引き直すので）
        expect(after.x).toBeCloseTo(1, 1);
    });

    it('view: カメラが原点なら、行列はそのまま置き場のワールド行列（fov はカメラのもの）', () => {
        let seen;

        inScene(() => {
            const object = xthree.add(new THREE.Object3D());
            object.position.set(1, 2, -3);
            seen = xthree.view(object);
        });

        expect(seen.matrix[12]).toBeCloseTo(1);
        expect(seen.matrix[13]).toBeCloseTo(2);
        expect(seen.matrix[14]).toBeCloseTo(-3);
        expect(seen.fov).toBe(45);
    });

    it('view: カメラを動かした分だけ置き場が引かれる（カメラの逆行列が掛かっている）', () => {
        let seen;

        inScene(() => {
            const object = xthree.add(new THREE.Object3D());
            object.position.set(0, 0, -3);
            xthree.camera.position.set(0, 0, 2);
            seen = xthree.view(object);
        });

        expect(seen.matrix[14]).toBeCloseTo(-5);
    });

    // ここを落とすと、three が描くのはこのフレームの位置なのに DOM は前のフレームの位置になる
    it('view: 直前に動かした置き場でも、そのフレームの位置で返る', () => {
        let seen;

        inScene(() => {
            const parent = xthree.nest({ position: { x: 10, y: 0, z: 0 } });
            const object = xthree.add(new THREE.Object3D());
            object.position.set(0, 0, -3);
            parent.position.x = 4;   // updateWorldMatrix は呼ばない
            seen = xthree.view(object);
        });

        expect(seen.matrix[12]).toBeCloseTo(4);
    });
});
