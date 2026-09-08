//----------------------------------------------------------------------------------------------------
// templates/table — 四畳半（半畳を中心に置いた風車敷き）の畳と、その上のちゃぶ台だけを置いた雛形。
//   畳とちゃぶ台の組み立ては room.js（wip/cat_king の render.js から移植）。ここは画面とカメラだけを持つ。
//   背景は白（renderer は透過なので body の白がそのまま背景になる）。マウスのドラッグ/ホイールで視点を操作。
//   canvas は 1024x1024 の固定解像度。fit = 'cover' で画面いっぱいに広げる（はみ出しぶんは切れる）。
//----------------------------------------------------------------------------------------------------

import { xnew, xbasics } from '@mulsense/xnew';
import { xthree } from '@mulsense/xnew/addons/xthree';
import * as THREE from 'three';
import { Room } from './room.js';

const SCREEN_SIZE = 1024;   // canvas の固定解像度（正方形）
const FOV = 32;             // 縦画角（deg）。望遠ぎみにしてパースを弱め、畳の目地の歪みを抑える

xnew(document.querySelector('#main'), Main);

//----------------------------------------------------------------------------------------------------
// Main — Screen + three をセットアップし、カメラと部屋（room.js の Room）を置く。
//   canvas は 1024x1024 の固定解像度。fit = 'cover' なので画面の縦横比に関わらず余白なく埋まる
//   （長い方の辺がはみ出して切れる）。解像度が固定 = リサイズでバッファを作り直さないのでちらつかない。
//----------------------------------------------------------------------------------------------------

function Main(unit, { size = SCREEN_SIZE } = {}) {
    xnew.protect();
    xnew.extend(xbasics.Screen, { width: size, height: size, fit: 'cover' });

    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
    xthree.init({ canvas: unit.canvas, camera });
    xthree.renderer.shadowMap.enabled = true;
    xthree.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    xnew.promise(unit).then(() => {
        unit.on('update', () => xthree.renderer.render(xthree.scene, xthree.camera));

        xnew(Camera, { camera });
        xnew(Room);
    });
}

//----------------------------------------------------------------------------------------------------
// Camera — 原点まわりの軌道カメラ。ドラッグで回り込み（水平＋上下）、ホイールで寄り引き。
//   scene ごと回すと光源や影も一緒に回ってしまうので、カメラ自身を球面座標で動かす。
//----------------------------------------------------------------------------------------------------

function Camera(unit, { camera }) {
    const target = new THREE.Vector3(0, 0.1, 0);   // 四畳半の中心（ちゃぶ台の少し下）を注視
    let yaw = 0;              // 水平方向の回り込み
    let pitch = 0.66;         // 見下ろし角（rad）。真上・真横まで行くと絵が破綻するので下でクランプする
    let distance = 6.6;       // 注視点からの距離

    function apply() {
        pitch = Math.min(Math.PI / 2 - 0.05, Math.max(0.08, pitch));
        distance = Math.min(12, Math.max(2, distance));
        camera.position.set(
            target.x + distance * Math.cos(pitch) * Math.sin(yaw),
            target.y + distance * Math.sin(pitch),
            target.z + distance * Math.cos(pitch) * Math.cos(yaw),
        );
        camera.lookAt(target);
    }
    apply();

    // タッチのスクロールや右クリックメニューが視点操作を邪魔しないよう抑止する
    unit.on('touchstart contextmenu wheel', ({ event }) => event.preventDefault());
    unit.on('dragmove', ({ delta }) => {
        yaw -= delta.x * 0.006;
        pitch += delta.y * 0.006;
        apply();
    });
    unit.on('wheel', ({ delta }) => {
        distance *= 1 + delta.y * 0.001;
        apply();
    });
}
