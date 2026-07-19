//----------------------------------------------------------------------------------------------------
// render — ブラウザ専用のグラフィックス束（Pixi / Three / addons / voxelkit）。
//   game.js は server(Node) と client(browser) の両方で評価されるため Pixi/Three を静的 import できない。
//   そこで browser 専用のこのファイルへ集約し、index.js が window.gfx に載せて game.js の client 分岐へ渡す
//   （io を window.io で渡すのと同じ流儀）。Node はこのファイルを一切読み込まない。
//----------------------------------------------------------------------------------------------------

import { xnew, xbasics } from '@mulsense/xnew';
import { xpixi } from '@mulsense/xnew/addons/xpixi';
import { xthree } from '@mulsense/xnew/addons/xthree';
import * as PIXI from 'pixi.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin } from '@pixiv/three-vrm';
import { VRMAnimationLoaderPlugin, createVRMAnimationClip } from '@pixiv/three-vrm-animation';
import voxelkit from 'voxelkit';

export const Screen = xbasics.Screen;
export { xpixi, xthree, PIXI, THREE };

//----------------------------------------------------------------------------------------------------
// Character — .mog ボクセルモデルを VRM に変換して読み込み、歩きモーション（VRMA）をループ再生する。
//   three_mog サンプルと同じ読み込み経路。座席位置に立たせ、その場で軽く上下する足踏みを足す。
//----------------------------------------------------------------------------------------------------

export function Character(unit, { mogPath, vrmaPath, x = 0, z = 0, scale = 1 }) {
    const object = xthree.nest(new THREE.Object3D());
    object.position.set(x, 0, z);
    object.scale.setScalar(scale);
    object.rotation.y = Math.atan2(-x, -z);   // ざっくりテーブル中央を向かせる

    // mog → voxelkit → VRM（arrayBuffer）→ GLTFLoader + VRMLoaderPlugin で vrm を得る
    xnew.promise('vrm', voxelkit.load(mogPath)
        .then((composits) => voxelkit.convertVRM(composits[0]))
        .then((arrayBuffer) => new Promise((resolve, reject) => {
            const loader = new GLTFLoader();
            loader.register((parser) => new VRMLoaderPlugin(parser));
            loader.parse(arrayBuffer.buffer, '', (gltf) => resolve(gltf.userData.vrm), reject);
        })));

    // 歩きモーション（VRMA）
    xnew.promise('vrma', new Promise((resolve) => {
        const loader = new GLTFLoader();
        loader.register((parser) => new VRMAnimationLoaderPlugin(parser));
        loader.load(vrmaPath, (gltf) => resolve(gltf.userData.vrmAnimations[0]));
    }));

    xnew.promise(unit).then(({ vrm, vrma }) => {
        vrm.scene.traverse((obj) => { if (obj.isMesh) { obj.castShadow = true; obj.receiveShadow = true; } });
        object.add(vrm.scene);

        const mixer = new THREE.AnimationMixer(vrm.scene);
        const action = mixer.clipAction(createVRMAnimationClip(vrma, vrm));
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.play();

        const clock = new THREE.Clock();
        unit.on('update', () => {
            const delta = clock.getDelta();
            mixer.update(delta);
            vrm.update(delta);
            object.position.y = Math.abs(Math.sin(clock.elapsedTime * 5)) * 0.05;   // その場足踏みの上下
        });
    });
}
