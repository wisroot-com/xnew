//----------------------------------------------------------------------------------------------------
// three_table — 四畳半（半畳を中心に置いた風車敷き）の畳と、その上のちゃぶ台。
//   畳は xtextures.tatami を 1 枚ぶんだけ焼いた MeshStandardMaterial を板ごとに貼る（xtextures の
//   scale = セル 1 つの実寸なので、そのまま 0.88m の畳として置ける）。ちゃぶ台とキャラは wip/cat_king の移植。
//----------------------------------------------------------------------------------------------------

import { xnew, xbasics, xtextures } from '@mulsense/xnew';
import { xthree } from '@mulsense/xnew/addons/xthree';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin } from '@pixiv/three-vrm';
import { VRMAnimationLoaderPlugin, createVRMAnimationClip } from '@pixiv/three-vrm-animation';
import voxelkit from 'voxelkit';

const MAT = 0.88;              // 畳の短辺（m）。長辺は 2 倍、半畳は正方形
// ちゃぶ台は wip/cat_king と同じ「畳の短辺 = 1」基準の比率。半径だけは四畳半が隠れないよう 1.2 → 0.6 に詰めた
const TABLE_RADIUS = 0.6 * MAT;      // 天板の半径（直径 1.06m）
const TABLE_THICKNESS = 0.07 * MAT;  // 天板の厚み（側面の高さ）
const TABLE_TOP_Y = 0.25 * MAT;      // 天面の高さ（22cm の座卓）

// 檜風の淡い木目 = wood の hinoki プリセット
const WOOD_PARAMS = xtextures.wood.presets.hinoki;

// ちゃぶ台を囲む .mog ボクセルキャラ（VRM に変換して読み込む）
const CHARACTERS = [
    { mog: 'zundamon', angle: 0 },
    { mog: 'itako', angle: Math.PI / 2 },
    { mog: 'zunko', angle: Math.PI },
    { mog: 'kiritan', angle: -Math.PI / 2 },
];
const VRMA = '../../assets/walk.vrma';

// 四畳半の風車敷き: 中央に半畳、その周りを 4 枚が風車状に囲む（部屋は 3x3 畳単位 = 2.64m 四方）
const LAYOUT = [
    { x: 0, z: 0, aspect: 1, turned: false },            // 中央の半畳
    { x: -0.5, z: -1, aspect: 2, turned: false },        // 北
    { x: 1, z: -0.5, aspect: 2, turned: true },          // 東
    { x: 0.5, z: 1, aspect: 2, turned: false },          // 南
    { x: -1, z: 0.5, aspect: 2, turned: true },          // 西
];

xnew(document.querySelector('#main'), Main);

//----------------------------------------------------------------------------------------------------
// Main — Screen + three をセットアップし、ライト / 四畳半の床 / ちゃぶ台を並べる。ドラッグで回転・ホイールでズーム。
//----------------------------------------------------------------------------------------------------

function Main(unit, { size = 1024 } = {}) {
    xnew.protect();
    xnew.extend(xbasics.Screen, { width: size, height: size });

    // 望遠ぎみ（低 FOV + カメラを引く）でパースを弱め、畳の目地の歪みを抑える
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 4.0, 5.2);
    camera.lookAt(0, -0.35, 0);   // 少し下を狙って、四畳半が画面の中央に収まるようにする
    xthree.initialize({ canvas: unit.canvas, camera });
    xthree.renderer.shadowMap.enabled = true;
    xthree.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    xnew.promise(unit).then(() => {
        unit.on('update', () => xthree.renderer.render(xthree.scene, xthree.camera));

        xnew(Lights);
        xnew(Floor);
        xnew(Chabudai);
        CHARACTERS.forEach(({ mog, angle }) => {
            const radius = TABLE_RADIUS + 0.25;
            xnew(Character, { mogPath: `../../assets/${mog}.mog`, x: Math.sin(angle) * radius, z: Math.cos(angle) * radius });
        });
    });

    // ドラッグでシーンを回す / ホイールでカメラを寄せる
    unit.on('touchstart contextmenu wheel', ({ event }) => event.preventDefault());
    unit.on('dragmove', ({ delta }) => { xthree.scene.rotation.y += delta.x * 0.008; });
    unit.on('wheel', ({ delta }) => {
        const next = camera.position.length() * (1 + delta.y * 0.001);
        camera.position.setLength(Math.min(10, Math.max(1.5, next)));
    });
}

//----------------------------------------------------------------------------------------------------
// Lights — 斜め上からの主光源（影を落とす）と、全体を持ち上げる環境光
//----------------------------------------------------------------------------------------------------

function Lights(unit) {
    const dir = xthree.add(new THREE.DirectionalLight(0xfff2e0, 2.0));
    dir.position.set(2, 4, 3);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    Object.assign(dir.shadow.camera, { left: -2.5, right: 2.5, top: 2.5, bottom: -2.5, near: 0.5, far: 12 });
    dir.shadow.camera.updateProjectionMatrix();
    dir.shadow.bias = -0.0005;

    xthree.add(new THREE.AmbientLight(0xffffff, 0.55));
    xthree.add(new THREE.HemisphereLight(0xffffff, 0x6b5a44, 0.45));
}

//----------------------------------------------------------------------------------------------------
// Floor — 四畳半ぶんの畳を LAYOUT どおりに敷く。畳ごとに seed を変えて、同じ模様が並ばないようにする
//----------------------------------------------------------------------------------------------------

function Floor(unit) {
    LAYOUT.forEach((mat, index) => xnew(Mat, { ...mat, seed: index * 13 }));
}

//----------------------------------------------------------------------------------------------------
// Mat — 畳 1 枚。tatami のセルは正方形なので、1 セルだけ焼いた map を実寸 (aspect x 1) の板へ貼る
//----------------------------------------------------------------------------------------------------

function Mat(unit, { x, z, aspect, turned, seed }) {
    const material = xthree.material.standard(xtextures.tatami, {
        params: { scale: MAT, aspect, seed },
        worldSize: MAT,                                  // scale と同じ = 畳ちょうど 1 枚ぶんを焼く
        size: { width: 512 * aspect, height: 512 },      // 長辺ぶん横に伸ばして解像度を合わせる
        roughness: 1,
    });
    const mesh = xthree.add(new THREE.Mesh(new THREE.PlaneGeometry(MAT * aspect, MAT), material));
    // Euler XYZ は z（面内の回転 = 畳の向き）が先に効き、そのあと x で床に寝かせる
    mesh.rotation.set(-Math.PI / 2, 0, turned ? Math.PI / 2 : 0);
    mesh.position.set(x * MAT, 0, z * MAT);
    mesh.receiveShadow = true;
}

//----------------------------------------------------------------------------------------------------
// Chabudai — 円形ちゃぶ台（天板 + 折れ脚）。木目は xtextures.wood を檜風の淡い色で焼いたマテリアル
//----------------------------------------------------------------------------------------------------

function Chabudai(unit) {
    const group = xthree.nest();

    // 天板: 円柱（側面=横木目 / 天面=年輪 / 底面=無地）。天面・側面とも同じ木目パラメータで焼く
    const topMaterials = [
        xthree.material.standard(xtextures.wood, {                          // 側面（横長 canvas で木目が横に流れる）
            size: { width: 512, height: 64 }, worldSize: 1.5, params: WOOD_PARAMS,
            tile: true, repeat: { x: 3, y: 1 },   // 周方向に 3 回シームレスにタイルして木目を細かく
            roughness: 0.65,
        }),
        xthree.material.standard(xtextures.wood, {                          // 天面
            size: { width: 512, height: 512 }, worldSize: 1.5, params: WOOD_PARAMS,
            roughness: 0.55,
        }),
        new THREE.MeshStandardMaterial({ color: 0xcab6a2, roughness: 0.7 }),   // 底面
    ];
    const top = new THREE.Mesh(new THREE.CylinderGeometry(TABLE_RADIUS, TABLE_RADIUS, TABLE_THICKNESS, 64, 1), topMaterials);
    top.position.y = TABLE_TOP_Y;
    top.castShadow = true;
    top.receiveShadow = true;
    group.add(top);

    // 脚: 天板の下、外向きに少し開いた 4 本。木目の傾きを保ったまま +90° して縦木目にする
    const legMaterial = xthree.material.standard(xtextures.wood, {
        size: { width: 128, height: 256 }, worldSize: 1, params: { ...WOOD_PARAMS, angle: WOOD_PARAMS.angle + 90 },
        roughness: 0.6,
    });
    const legHeight = TABLE_TOP_Y - TABLE_THICKNESS / 2;   // 床から天板の裏まで
    for (let i = 0; i < 4; i++) {
        const angle = Math.PI / 4 + i * Math.PI / 2;
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * MAT, 0.06 * MAT, legHeight, 16), legMaterial);
        const r = TABLE_RADIUS * 0.85;   // 円の外側寄りに配置
        leg.position.set(Math.cos(angle) * r, legHeight / 2, Math.sin(angle) * r);
        leg.rotation.z = -Math.cos(angle) * 0.14;    // 外向きに開く
        leg.rotation.x = Math.sin(angle) * 0.14;
        leg.castShadow = true;
        group.add(leg);
    }
}

//----------------------------------------------------------------------------------------------------
// Character — .mog を VRM に変換して読み込み、歩きモーション（VRMA）をループ。ちゃぶ台の中央を向いて立つ
//----------------------------------------------------------------------------------------------------

function Character(unit, { mogPath, x = 0, z = 0, scale = 1.1 }) {
    const object = xthree.nest({ position: { x, y: 0, z }, scale, rotation: { x: 0, y: Math.atan2(-x, -z) } });   // ちゃぶ台の中央を向く

    xnew.promise('vrm', voxelkit.load(mogPath)
        .then((composits) => voxelkit.convertVRM(composits[0]))
        .then((arrayBuffer) => new Promise((resolve, reject) => {
            const loader = new GLTFLoader();
            loader.register((parser) => new VRMLoaderPlugin(parser));
            loader.parse(arrayBuffer.buffer, '', (gltf) => resolve(gltf.userData.vrm), reject);
        })));

    xnew.promise('vrma', new Promise((resolve) => {
        const loader = new GLTFLoader();
        loader.register((parser) => new VRMAnimationLoaderPlugin(parser));
        loader.load(VRMA, (gltf) => resolve(gltf.userData.vrmAnimations[0]));
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
            object.position.y = Math.abs(Math.sin(clock.elapsedTime * 5)) * 0.03;   // その場足踏み
        });
    });
}
