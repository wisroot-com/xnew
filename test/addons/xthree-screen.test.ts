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
// xthree.view — シーンを画面から見る 1 つ。object の座標で渡した点が、画面の割合（point2d:
//   xbasics.Pin が取る形）・カメラ視点の 3D（point3d）・置き場の行列 + fov（xbasics.Plane が取る形）
//   になって返る。置くところは xbasics 側の担当（test/basics/stage/）なので、ここは見る計算だけ。
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

    it('point2d: 視線上の点は画面の中央、カメラの後ろは null', () => {
        let center;
        let behind;

        inScene(() => {
            center = xthree.view(xthree.scene, new THREE.Vector3(0, 0, -3));
            behind = xthree.view(xthree.scene, new THREE.Vector3(0, 0, 3));
        });

        expect(center.point2d.x).toBeCloseTo(0.5);
        expect(center.point2d.y).toBeCloseTo(0.5);
        expect(behind.point2d).toBeNull();
    });

    it('point3d: カメラ視点の 3D。カメラを動かした分だけ引かれる', () => {
        let seen;

        inScene(() => {
            xthree.camera.position.set(0, 0, 2);
            seen = xthree.view(xthree.scene, new THREE.Vector3(0, 1, -3));
        });

        expect(seen.point3d.y).toBeCloseTo(1);
        expect(seen.point3d.z).toBeCloseTo(-5);
    });

    it('点は object の座標で読む（同じ点でも object が動けば行き先が変わる）', () => {
        let before;
        let after;

        inScene(() => {
            const object = xthree.add(new THREE.Object3D());
            object.position.set(0, 0, -3);

            before = xthree.view(object, new THREE.Vector3(0, 0, 0));
            object.position.x = 1.2426;   // 距離 3 での視野の右端
            after = xthree.view(object, new THREE.Vector3(0, 0, 0));
        });

        expect(before.point2d.x).toBeCloseTo(0.5);
        // 動かした直後でも、そのフレームの位置で読める（行列を引き直してから見るので）
        expect(after.point2d.x).toBeCloseTo(1, 1);
    });

    it('matrix: カメラが原点なら、行列はそのまま置き場のワールド行列（fov はカメラのもの）', () => {
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

    it('matrix: カメラを動かした分だけ置き場が引かれる（カメラの逆行列が掛かっている）', () => {
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
    it('matrix: 直前に動かした置き場でも、そのフレームの位置で返る', () => {
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
