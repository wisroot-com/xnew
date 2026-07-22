//----------------------------------------------------------------------------------------------------
// three_chabudai — three.js で立体的に組んだ円形ちゃぶ台（檜風の木目）と、周りに並ぶ .mog ボクセルキャラ。
//   木目（天面の年輪 / 側面・脚の横木目）は xtextures.Wood、床の畳は xtextures.Tatami を
//   非表示 canvas に焼いた CanvasTexture で表現する（手描き canvas はカードの数字面のみ）。
//----------------------------------------------------------------------------------------------------

import { xnew, xbasics, xtextures } from '@mulsense/xnew';
import { xthree } from '@mulsense/xnew/addons/xthree';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin } from '@pixiv/three-vrm';
import { VRMAnimationLoaderPlugin, createVRMAnimationClip } from '@pixiv/three-vrm-animation';
import voxelkit from 'voxelkit';

const TABLE_RADIUS = 1.2;      // 天板の半径
const TABLE_THICKNESS = 0.07;  // 天板の厚み（側面の高さ）
const TABLE_TOP_Y = 0.25;      // 天面の高さ（= 脚の長さ。ちゃぶ台なので低め）
const CHARACTERS = [
    { mog: 'zundamon', angle: 0 },
    { mog: 'itako', angle: Math.PI / 2 },
    { mog: 'zunko', angle: Math.PI },
    { mog: 'kiritan', angle: -Math.PI / 2 },
];
const VRMA = '../../assets/walk.vrma';

xnew(document.querySelector('#main'), Main);

//----------------------------------------------------------------------------------------------------
// Main — Screen + three をセットアップし、ライト / 地面 / ちゃぶ台 / キャラを並べる。ドラッグで回転・ホイールでズーム。
//----------------------------------------------------------------------------------------------------

function Main(unit, { size = 1024 } = {}) {
    xnew.protect();
    xnew.extend(xbasics.Screen, { width: size, height: size });

    // 望遠ぎみ（低 FOV + カメラを引く）でパースを弱め、ちゃぶ台の歪みを抑える
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 3.8, 4.3);
    camera.lookAt(0, 0.5, 0);
    xthree.initialize({ canvas: unit.canvas, camera });
    xthree.renderer.shadowMap.enabled = true;
    xthree.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    xnew.promise(unit).then(() => {
        unit.on('update', () => xthree.renderer.render(xthree.scene, xthree.camera));

        xnew(Lights);
        xnew(Ground);
        xnew(Chabudai);
        xnew(Cards);
        CHARACTERS.forEach(({ mog, angle }) => {
            const radius = TABLE_RADIUS + 0.2;
            xnew(Character, { mogPath: `../../assets/${mog}.mog`, x: Math.sin(angle) * radius, z: Math.cos(angle) * radius });
        });
    });

    // ドラッグでシーンを回す / ホイールでカメラを寄せる（テーブルのデザイン確認用）
    unit.on('touchstart contextmenu wheel', ({ event }) => event.preventDefault());
    unit.on('dragmove', ({ delta }) => { xthree.scene.rotation.y += delta.x * 0.008; });
    unit.on('wheel', ({ delta }) => {
        const next = camera.position.length() * (1 + delta.y * 0.001);
        camera.position.setLength(Math.min(8, Math.max(2, next)));
    });
}

//----------------------------------------------------------------------------------------------------
// Lights — 斜め上からの主光源（影を落とす）と、全体を持ち上げる環境光
//----------------------------------------------------------------------------------------------------

function Lights(unit) {
    const dir = xthree.add(new THREE.DirectionalLight(0xfff2e0, 2.2));
    dir.position.set(3, 6, 4);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    Object.assign(dir.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 0.5, far: 20 });
    dir.shadow.camera.updateProjectionMatrix();
    dir.shadow.bias = -0.0005;

    xthree.add(new THREE.AmbientLight(0xffffff, 1.0));
    xthree.add(new THREE.HemisphereLight(0xffffff, 0x6b5a44, 0.6));
}

//----------------------------------------------------------------------------------------------------
// bake — xtextures の指定チャンネルを非表示 canvas に焼き、CanvasTexture にする共通ヘルパー
//----------------------------------------------------------------------------------------------------

function bake(component, channel, params) {
    const baked = xnew(component, { channel, style: 'display: none;', ...params });
    const texture = new THREE.CanvasTexture(baked.canvas);
    texture.colorSpace = channel === 'color' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    texture.anisotropy = 8;
    return texture;
}

//----------------------------------------------------------------------------------------------------
// Ground — 影を受ける畳の床。xtextures.Tatami を焼いて map / normalMap として使う。
//   worldSize: 4 で畳(2x1)がタイルにちょうど収まるので、RepeatWrapping でシームレスに繰り返せる。
//----------------------------------------------------------------------------------------------------

function Ground(unit) {
    const ground = xthree.add(new THREE.Mesh(
        new THREE.PlaneGeometry(40, 40),
        new THREE.MeshStandardMaterial({
            map: bakeTatami('color'),
            normalMap: bakeTatami('normal'),
            roughness: 1,
        }),
    ));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
}

function bakeTatami(channel) {
    const texture = bake(xtextures.Tatami, channel, { size: { width: 512, height: 512 }, worldSize: 4 });
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(10, 10);   // 40x40 の床に 4 単位タイル → 畳(2x1) ≒ 2x1 単位
    return texture;
}

//----------------------------------------------------------------------------------------------------
// Chabudai — 円形ちゃぶ台（天板 + 脚）。木目は xtextures.Wood を檜風の淡い色で焼いた CanvasTexture。
//----------------------------------------------------------------------------------------------------

// 檜風の淡い木目（three_textures の copy params で調整した値）
const WOOD_PARAMS = {
    scale: 2.9, rings: 4.5, lengths: 10, angle: 20, fibers: 0.3, fibersDensity: 10, seed: 0,
    color: [0.792, 0.714, 0.635], background: [0.78, 0.616, 0.557],
};

function Chabudai(unit) {
    const group = xthree.nest();

    // 天面・側面とも同じ木目パラメータで焼く（側面は横長 canvas で木目が横に流れる）
    const topTexture = bake(xtextures.Wood, 'color', {
        size: { width: 512, height: 512 }, worldSize: 3, ...WOOD_PARAMS,
    });
    const sideTexture = bake(xtextures.Wood, 'color', {
        size: { width: 512, height: 64 }, worldSize: 3, ...WOOD_PARAMS,
    });
    sideTexture.wrapS = THREE.RepeatWrapping;
    sideTexture.repeat.set(3, 1);   // 周方向に 3 回タイルして木目を細かく

    // 天板: 円柱（側面=横木目テクスチャ / 天面=年輪テクスチャ / 底面=無地）
    const topMaterials = [
        new THREE.MeshStandardMaterial({ map: sideTexture, roughness: 0.65 }),                        // 側面
        new THREE.MeshStandardMaterial({ map: topTexture, roughness: 0.55, metalness: 0.0 }),         // 天面
        new THREE.MeshStandardMaterial({ color: 0xcab6a2, roughness: 0.7 }),                          // 底面
    ];
    const top = new THREE.Mesh(new THREE.CylinderGeometry(TABLE_RADIUS, TABLE_RADIUS, TABLE_THICKNESS, 64, 1), topMaterials);
    top.position.y = TABLE_TOP_Y;
    top.castShadow = true;
    top.receiveShadow = true;
    group.add(top);

    // 脚: 天板の下、外向きに少し開いた 4 本。木目の傾きを保ったまま +90° して縦木目にする
    const legTexture = bake(xtextures.Wood, 'color', {
        size: { width: 128, height: 256 }, worldSize: 2, ...WOOD_PARAMS, angle: WOOD_PARAMS.angle + 90,
    });
    const legHeight = TABLE_TOP_Y - TABLE_THICKNESS / 2;   // 床から天板の裏まで
    const legMaterial = new THREE.MeshStandardMaterial({ map: legTexture, roughness: 0.6 });
    for (let i = 0; i < 4; i++) {
        const angle = Math.PI / 4 + i * Math.PI / 2;
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, legHeight, 16), legMaterial);
        const r = TABLE_RADIUS * 0.85;   // 円の外側寄りに配置
        leg.position.set(Math.cos(angle) * r, legHeight / 2, Math.sin(angle) * r);
        leg.rotation.z = -Math.cos(angle) * 0.14;    // 外向きに開く
        leg.rotation.x = Math.sin(angle) * 0.14;
        leg.castShadow = true;
        group.add(leg);
    }
}

//----------------------------------------------------------------------------------------------------
// Cards — 天面に数枚の 3D カード（薄い箱 + 数字テクスチャ）を無造作に散らす。
//----------------------------------------------------------------------------------------------------

function Cards(unit) {
    const count = 6;
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * TABLE_RADIUS * 0.6;
        xnew(Card, {
            x: Math.cos(angle) * r,
            z: Math.sin(angle) * r,
            rot: Math.random() * Math.PI * 2,
            number: 1 + Math.floor(Math.random() * 13),
            red: Math.random() < 0.5,
            index: i,
        });
    }
}

function Card(unit, { x, z, rot, number, red, index }) {
    const w = 0.17, length = 0.25, thickness = 0.006;
    const white = new THREE.MeshStandardMaterial({ color: 0xf6f4ee, roughness: 0.6 });
    const face = new THREE.MeshStandardMaterial({ map: makeCardFaceTexture(number, red), roughness: 0.5 });
    // BoxGeometry のマテリアル順 [+x,-x,+y,-y,+z,-z]。上面(+y=index 2)だけ数字の面にする。
    const mesh = xthree.add(new THREE.Mesh(
        new THREE.BoxGeometry(w, thickness, length),
        [white, white, face, white, white, white],
    ));
    // 天面に接地。重なり時の上下判定を安定させるため index ぶんだけごく僅かに持ち上げる（浮きは最小限）
    mesh.position.set(x, TABLE_TOP_Y + TABLE_THICKNESS / 2 + thickness / 2 + index * 0.0012, z);
    mesh.rotation.y = rot;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
}

function makeCardFaceTexture(number, red) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 192;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#faf8f2';
    ctx.fillRect(0, 0, 128, 192);
    ctx.strokeStyle = '#d8d2c4';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, 120, 184);

    const label = number === 1 ? 'A' : number === 11 ? 'J' : number === 12 ? 'Q' : number === 13 ? 'K' : String(number);
    ctx.fillStyle = red ? '#c0392b' : '#2b2b33';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 34px sans-serif';
    ctx.fillText(label, 12, 10);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 96px sans-serif';
    ctx.fillText(label, 64, 100);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
}

//----------------------------------------------------------------------------------------------------
// Character — .mog を VRM に変換して読み込み、歩きモーション（VRMA）をループ。テーブル中央を向いて立つ。
//----------------------------------------------------------------------------------------------------

function Character(unit, { mogPath, x = 0, z = 0, scale = 1.1 }) {
    const object = xthree.nest({ position: { x, y: 0, z }, scale, rotation: { x: 0, y: Math.atan2(-x, -z) } });   // テーブル中央を向く

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
