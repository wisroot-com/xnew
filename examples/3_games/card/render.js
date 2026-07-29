//----------------------------------------------------------------------------------------------------
// render — ブラウザ専用のグラフィックス束（Pixi / Three / addons / voxelkit）。
//   game.js は server(Node) と client(browser) の両方で評価されるため Pixi/Three を静的 import できない。
//   そこで browser 専用のこのファイルへ集約し、index.js が window.gfx に載せて game.js の client 分岐へ渡す
//   （io を window.io で渡すのと同じ流儀）。Node はこのファイルを一切読み込まない。
//   3D の見た目（畳の床・円形ちゃぶ台・3D カード・ボクセルキャラ）は 2_addons/three_chabudai を移植したもので、
//   畳・木目は同じく xthree.material.standard() が xtextures を焼いた MeshStandardMaterial で表現する。
//----------------------------------------------------------------------------------------------------

import { xnew, xbasics, xtextures } from '@mulsense/xnew';
import { xpixi } from '@mulsense/xnew/addons/xpixi';
import { xthree } from '@mulsense/xnew/addons/xthree';
import * as PIXI from 'pixi.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin } from '@pixiv/three-vrm';
import { VRMAnimationLoaderPlugin, createVRMAnimationClip } from '@pixiv/three-vrm-animation';
import voxelkit from 'voxelkit';

// テーブル寸法（座席やカードの配置に使うので game.js からも参照する）
const TABLE = { RADIUS: 1.2, THICKNESS: 0.07, TOP_Y: 0.25 };
const SURFACE_Y = TABLE.TOP_Y + TABLE.THICKNESS / 2;   // 天面の高さ
const CARD = { w: 0.17, length: 0.25, thickness: 0.006 };

export const Screen = xbasics.Screen;
export { xpixi, xthree, PIXI, THREE, TABLE };

// ワールド 3D 座標を canvas 2D 座標へ写す（名札など 2D オーバーレイの位置合わせ用）
export function coord3dTo2d(x, y, z) {
    const camera = xthree.camera;
    camera.updateMatrixWorld();
    const projected = new THREE.Vector3(x, y, z).project(camera);
    return new THREE.Vector2((projected.x + 1) / 2 * xthree.canvas.width, (1 - projected.y) / 2 * xthree.canvas.height);
}

//----------------------------------------------------------------------------------------------------
// Lights — 斜め上からの主光源（影を落とす）と、全体を持ち上げる環境光
//----------------------------------------------------------------------------------------------------

export function Lights(unit) {
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
// Ground — 影を受ける畳の床。xthree.material.standard() が xtextures.tatami の color / normal を焼いて
//   map / normalMap に組む。worldSize: 4 で畳(2x1)がタイルにちょうど収まるので、repeat でシームレスに繰り返せる。
//----------------------------------------------------------------------------------------------------

export function Ground(unit) {
    const material = xthree.material.standard(xtextures.tatami, {
        size: { width: 512, height: 512 }, worldSize: 4,
        repeat: { x: 10, y: 10 },   // 40x40 の床に 4 単位タイル → 畳(2x1) ≒ 2x1 単位
        roughness: 1,
    });
    const ground = xthree.add(new THREE.Mesh(new THREE.PlaneGeometry(40, 40), material));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
}

//----------------------------------------------------------------------------------------------------
// Chabudai — 円形ちゃぶ台（天板 + 折れ脚）。木目は xtextures.wood を檜風の淡い色で焼いたマテリアル。
//----------------------------------------------------------------------------------------------------

// 檜風の淡い木目 = wood の hinoki プリセット
const WOOD_PARAMS = xtextures.wood.presets.hinoki;

export function Chabudai(unit) {
    const group = xthree.nest();

    // 天板: 円柱（側面=横木目 / 天面=年輪 / 底面=無地）。天面・側面とも同じ木目パラメータで焼く
    const topMaterials = [
        xthree.material.standard(xtextures.wood, {                          // 側面（横長 canvas で木目が横に流れる）
            size: { width: 512, height: 64 }, worldSize: 3, params: WOOD_PARAMS,
            tile: true, repeat: { x: 3, y: 1 },   // 周方向に 3 回シームレスにタイルして木目を細かく
            roughness: 0.65,
        }),
        xthree.material.standard(xtextures.wood, {                          // 天面
            size: { width: 512, height: 512 }, worldSize: 3, params: WOOD_PARAMS,
            roughness: 0.55, metalness: 0.0,
        }),
        new THREE.MeshStandardMaterial({ color: 0xcab6a2, roughness: 0.7 }),   // 底面
    ];
    const top = new THREE.Mesh(new THREE.CylinderGeometry(TABLE.RADIUS, TABLE.RADIUS, TABLE.THICKNESS, 64, 1), topMaterials);
    top.position.y = TABLE.TOP_Y;
    top.castShadow = true;
    top.receiveShadow = true;
    group.add(top);

    // 脚: 天板の下、外向きに少し開いた 4 本。木目の傾きを保ったまま +90° して縦木目にする
    const legHeight = TABLE.TOP_Y - TABLE.THICKNESS / 2;
    const legMaterial = xthree.material.standard(xtextures.wood, {
        size: { width: 128, height: 256 }, worldSize: 2, params: { ...WOOD_PARAMS, angle: WOOD_PARAMS.angle + 90 },
        roughness: 0.6,
    });
    for (let i = 0; i < 4; i++) {
        const angle = Math.PI / 4 + i * Math.PI / 2;
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, legHeight, 16), legMaterial);
        const r = TABLE.RADIUS * 0.85;
        leg.position.set(Math.cos(angle) * r, legHeight / 2, Math.sin(angle) * r);
        leg.rotation.z = -Math.cos(angle) * 0.14;
        leg.rotation.x = Math.sin(angle) * 0.14;
        leg.castShadow = true;
        group.add(leg);
    }
}

//----------------------------------------------------------------------------------------------------
// Card3D — 天面に置く 3D カード 1 枚（薄い箱 + 数字テクスチャ）。出したカードの表示に使う。
//----------------------------------------------------------------------------------------------------

export function Card3D(unit, { number, x = 0, z = 0, rot = 0, red = false }) {
    const mesh = xthree.add(new THREE.Mesh(
        new THREE.BoxGeometry(CARD.w, CARD.thickness, CARD.length),
        cardMaterials(makeCardFaceTexture(number, red)),
    ));
    mesh.position.set(x, SURFACE_Y + CARD.thickness / 2, z);
    mesh.rotation.y = rot;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
}

//----------------------------------------------------------------------------------------------------
// Deck3D — 天面中央に積む山札（裏向きの 3D カードの重なり）。枚数に応じて高さが変わる。
//----------------------------------------------------------------------------------------------------

export function Deck3D(unit, { count = 0 }) {
    const layers = Math.max(1, Math.min(14, Math.round(count / 4)));
    const geometry = new THREE.BoxGeometry(CARD.w, CARD.thickness, CARD.length);
    const materials = cardMaterials(makeCardBackTexture());
    for (let i = 0; i < layers; i++) {
        const mesh = xthree.add(new THREE.Mesh(geometry, materials));
        mesh.position.set(0, SURFACE_Y + CARD.thickness / 2 + i * CARD.thickness, 0);
        mesh.rotation.y = (i % 2) * 0.03;   // 少しずらして重なり感
        mesh.castShadow = true;
        mesh.receiveShadow = true;
    }
}

// BoxGeometry のマテリアル順 [+x,-x,+y,-y,+z,-z]。上面(+y=index 2)だけ絵柄、他は白い小口。
function cardMaterials(topTexture) {
    const white = new THREE.MeshStandardMaterial({ color: 0xf6f4ee, roughness: 0.6 });
    const face = new THREE.MeshStandardMaterial({ map: topTexture, roughness: 0.5 });
    return [white, white, face, white, white, white];
}

//----------------------------------------------------------------------------------------------------
// Character — .mog を VRM に変換して読み込み、歩きモーション（VRMA）をループ。テーブル中央を向いて立つ。
//----------------------------------------------------------------------------------------------------

export function Character(unit, { mogPath, vrmaPath, x = 0, z = 0, scale = 1.1 }) {
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
            object.position.y = Math.abs(Math.sin(clock.elapsedTime * 5)) * 0.03;   // その場足踏み
        });
    });
}

//----------------------------------------------------------------------------------------------------
// テクスチャ生成（カードの絵柄のみ手描き canvas。畳・木目は xtextures で焼く）
//----------------------------------------------------------------------------------------------------

// カードの表面（数字）
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

// カードの裏面（山札）
function makeCardBackTexture(size = 128) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = Math.floor(size * 1.5);
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;

    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#2563eb';
    ctx.fillRect(8, 8, w - 16, h - 16);
    // 斜め格子
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 2;
    for (let d = -h; d < w; d += 14) {
        ctx.beginPath(); ctx.moveTo(d, 0); ctx.lineTo(d + h, h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(d + h, 0); ctx.lineTo(d, h); ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
}
