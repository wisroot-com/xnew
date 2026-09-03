//----------------------------------------------------------------------------------------------------
// render — ブラウザ専用のグラフィックス束（Pixi / Three / xtextures / voxelkit）。
//   game.js は server(Node) と client(browser) の両方で評価されるため Pixi/Three を静的 import できない。
//   そこで browser 専用のこのファイルへ集約し、index.js が window.gfx に載せて game.js の client 分岐へ渡す
//   （io を window.io で渡すのと同じ流儀）。Node はこのファイルを一切読み込まない。
//   3D の見た目（四畳半の畳・円形ちゃぶ台・ボクセルキャラ）は 2_addons/three_table のモデルを移植。
//----------------------------------------------------------------------------------------------------

import { xnew, xbasics, xtextures } from '@mulsense/xnew';
import { SUIT_MARKS, RANK_LABELS, SUIT_COLORS } from './game.js';
import { xpixi } from '@mulsense/xnew/addons/xpixi';
import { xthree } from '@mulsense/xnew/addons/xthree';
import * as PIXI from 'pixi.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin } from '@pixiv/three-vrm';
import { VRMAnimationLoaderPlugin, createVRMAnimationClip } from '@pixiv/three-vrm-animation';
import voxelkit from 'voxelkit';

const MAT = 1;                                         // 畳の短辺（world）。ちゃぶ台の寸法もこの単位系
// テーブル寸法（座席やカード配置に使うので game.js からも参照する）
const TABLE = { RADIUS: 1.2, THICKNESS: 0.07, TOP_Y: 0.25 };
const SURFACE_Y = TABLE.TOP_Y + TABLE.THICKNESS / 2;   // 天面の高さ
// 場は 4 スート x 13 ランクの格子。両端の角（±6.5 列・±2 行）がちゃぶ台の円に収まる寸法にしてある
const BOARD = { cols: 13, rows: 4, cellX: 0.158, cellZ: 0.222 };
const CARD = { w: 0.142, length: 0.2, thickness: 0.005 };

export const Screen = xbasics.Screen;
export { xpixi, xthree, PIXI, THREE, TABLE, BOARD };

// 場のカード（suit 0..3 / rank 0..12）の天面上の world 座標。rank 6（=7）が中央列
export function cardWorld(suit, rank) {
    return { x: (rank - (BOARD.cols - 1) / 2) * BOARD.cellX, z: (suit - (BOARD.rows - 1) / 2) * BOARD.cellZ };
}

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
    Object.assign(dir.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 16 });
    dir.shadow.camera.updateProjectionMatrix();
    dir.shadow.bias = -0.0003;

    xthree.add(new THREE.AmbientLight(0xffffff, 1.0));
    xthree.add(new THREE.HemisphereLight(0xffffff, 0x6b5a44, 0.6));
}

//----------------------------------------------------------------------------------------------------
// Floor — 影を受ける畳の床。四畳半の風車敷きを 1 ブロックとして敷き詰める（1 枚の板に repeat で貼ると
//   畳の向きが揃ってしまうので、three_table と同じく 1 枚ずつ実寸の板として並べる）。
//----------------------------------------------------------------------------------------------------

// 四畳半の風車敷き: 中央に半畳、その周りを 4 枚が風車状に囲む（1 ブロック = 3x3 畳単位）
const HANJO = [
    { x: 0, z: 0, aspect: 1, turned: false },            // 中央の半畳
    { x: -0.5, z: -1, aspect: 2, turned: false },        // 北
    { x: 1, z: -0.5, aspect: 2, turned: true },          // 東
    { x: 0.5, z: 1, aspect: 2, turned: false },          // 南
    { x: -1, z: 0.5, aspect: 2, turned: true },          // 西
];

// ブロックの敷き位置（畳単位）。カメラは手前 +z にいるので、画面外まで届くよう奥（-z）を厚めに敷く
const BLOCKS = [];
for (const x of [-3, 0, 3]) {
    for (const z of [-6, -3, 0]) {
        BLOCKS.push({ x, z });
    }
}

export function Floor(unit) {
    // 畳の材質は seed 違いを 3 枚だけ焼いて使い回す（45 枚ぶんを 1 枚ずつ焼くとベイクが重い）
    const materials = {};
    for (const aspect of [1, 2]) {
        for (let seed = 0; seed < 3; seed++) {
            materials[`${aspect}:${seed}`] = xthree.material.standard(xtextures.tatami, {
                params: { scale: MAT, aspect, seed: seed * 13 },
                worldSize: MAT,                                  // scale と同じ = 畳ちょうど 1 枚ぶんを焼く
                size: { width: 512 * aspect, height: 512 },      // 長辺ぶん横に伸ばして解像度を合わせる
                roughness: 1,
            });
        }
    }
    // ブロックと畳の index をずらして seed を選び、同じ模様が隣り合わないようにする
    BLOCKS.forEach((block, b) => {
        HANJO.forEach((mat, i) => {
            xnew(Mat, { ...mat, x: mat.x + block.x, z: mat.z + block.z, material: materials[`${mat.aspect}:${(b + i) % 3}`] });
        });
    });
}

//----------------------------------------------------------------------------------------------------
// Mat — 畳 1 枚。tatami のセルは正方形なので、1 セルだけ焼いた map を実寸 (aspect x 1) の箱の天面へ貼る
//----------------------------------------------------------------------------------------------------

const MAT_THICKNESS = 0.06 * MAT;   // 畳の厚み（実寸 55mm 相当）。天面を y=0 に保ちたいので下へ伸ばす

function Mat(unit, { x, z, aspect, turned, material }) {
    const geometry = new THREE.BoxGeometry(MAT * aspect, MAT_THICKNESS, MAT);
    wrapSideUv(geometry, MAT * aspect);
    const mesh = xthree.add(new THREE.Mesh(geometry, material));
    mesh.rotation.y = turned ? Math.PI / 2 : 0;
    mesh.position.set(x * MAT, -MAT_THICKNESS / 2, z * MAT);
    mesh.receiveShadow = true;
}

// 側面の UV を貼り替えて、天面と同じ畳テクスチャを断面へ回り込ませる（側面用の単色マテリアルを持たない
// ので、ヘリの色や幅を変えると側面もそのまま追従する）。BoxGeometry の頂点順は px,nx,py,ny,pz,nz。
function wrapSideUv(geometry, length) {
    const position = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    // 短辺(±x): テクスチャの v 軸（＝短辺方向）をなぞるので、両端にヘリが乗る
    for (let i = 0; i < 8; i++) {
        const depth = 0.5 - position.getY(i) / MAT_THICKNESS;        // 0 = 天面側 / 1 = 裏側
        // u は継ぎ目の陰を避けて端の少し内側。厚み方向へわずかに振るのは normalMap の接空間を潰さないため
        const u = i < 4 ? 0.97 - 0.02 * depth : 0.03 + 0.02 * depth;
        uv.setXY(i, u, 0.5 - position.getZ(i) / MAT);                // BoxGeometry の天面 UV は -z 側が v=1
    }
    // 長辺(±z): ヘリの帯（v が 0 / 1 の側）の中を長辺方向へなぞる
    for (let i = 16; i < 24; i++) {
        const depth = 0.5 - position.getY(i) / MAT_THICKNESS;
        const v = i < 20 ? 0.006 + 0.01 * depth : 0.994 - 0.01 * depth;
        uv.setXY(i, 0.5 + position.getX(i) / length, v);
    }
    uv.needsUpdate = true;
}

//----------------------------------------------------------------------------------------------------
// Chabudai — 円形ちゃぶ台（天板 + 折れ脚）。木目は xtextures.wood を檜風の淡い色で焼いたマテリアル。
//----------------------------------------------------------------------------------------------------

// 檜風の淡い木目 = wood の hinoki プリセット
const WOOD_PARAMS = xtextures.wood.presets.hinoki;

export function Chabudai(unit) {
    const group = xthree.nest();

    // 天板: 縁を丸めた円盤（側面=横木目 / 天面=年輪 / 底面=無地）。天面・側面とも同じ木目パラメータで焼く
    const sideMaterial = xthree.material.standard(xtextures.wood, {          // 側面（横長 canvas で木目が横に流れる）
        size: { width: 512, height: 64 }, worldSize: 3, params: WOOD_PARAMS,
        tile: true, repeat: { x: 3, y: 1 },   // 周方向に 3 回シームレスにタイルして木目を細かく
        roughness: 0.65,
    });
    const faceMaterial = xthree.material.standard(xtextures.wood, {          // 天面
        size: { width: 512, height: 512 }, worldSize: 3, params: WOOD_PARAMS,
        roughness: 0.55,
    });
    const backMaterial = new THREE.MeshStandardMaterial({ color: 0xcab6a2, roughness: 0.7 });   // 底面

    // 天面・底面は平面 UV（年輪）を保ちたいので円柱ひとつにせず、丸めた側面 + 円盤 2 枚に分ける
    const top = new THREE.Group();
    top.position.y = TABLE.TOP_Y;
    group.add(top);

    // 側面: 上下の縁を 1/4 円で丸めた輪郭を回す。Lathe の v は点の index 割りなので直線部も分割して木目の伸びを揃える
    const EDGE = TABLE.THICKNESS * 0.35;             // 縁の丸みの半径
    const capRadius = TABLE.RADIUS - EDGE;
    const profile = [];
    for (let i = 0; i <= 4; i++) {                   // 下の縁（-90°→0°）
        const t = -Math.PI / 2 + Math.PI / 2 * (i / 4);
        profile.push(new THREE.Vector2(capRadius + EDGE * Math.cos(t), -TABLE.THICKNESS / 2 + EDGE + EDGE * Math.sin(t)));
    }
    profile.push(new THREE.Vector2(TABLE.RADIUS, 0));
    for (let i = 0; i <= 4; i++) {                   // 上の縁（0°→90°）
        const t = Math.PI / 2 * (i / 4);
        profile.push(new THREE.Vector2(capRadius + EDGE * Math.cos(t), TABLE.THICKNESS / 2 - EDGE + EDGE * Math.sin(t)));
    }
    const side = new THREE.Mesh(new THREE.LatheGeometry(profile, 64), sideMaterial);
    side.castShadow = true;
    side.receiveShadow = true;
    top.add(side);

    const face = new THREE.Mesh(new THREE.CircleGeometry(capRadius, 64), faceMaterial);
    face.rotation.x = -Math.PI / 2;
    face.position.y = TABLE.THICKNESS / 2;
    face.castShadow = true;
    face.receiveShadow = true;
    top.add(face);

    const back = new THREE.Mesh(new THREE.CircleGeometry(capRadius, 64), backMaterial);
    back.rotation.x = Math.PI / 2;
    back.position.y = -TABLE.THICKNESS / 2;
    back.castShadow = true;
    top.add(back);

    // 脚: 天板の下に垂直に立てた 4 本。木目の傾きを保ったまま +90° して縦木目にする
    const legHeight = TABLE.TOP_Y - TABLE.THICKNESS / 2;
    const legMaterial = xthree.material.standard(xtextures.wood, {
        size: { width: 128, height: 256 }, worldSize: 2, params: { ...WOOD_PARAMS, angle: WOOD_PARAMS.angle + 90 },
        roughness: 0.6,
    });
    for (let i = 0; i < 4; i++) {
        const angle = Math.PI / 4 + i * Math.PI / 2;
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.032 * MAT, 0.039 * MAT, legHeight, 16), legMaterial);
        const r = TABLE.RADIUS * 0.85;
        leg.position.set(Math.cos(angle) * r, legHeight / 2, Math.sin(angle) * r);
        leg.castShadow = true;
        group.add(leg);
    }
}

//----------------------------------------------------------------------------------------------------
// BoardGuide3D — 場のマス目（4x13 の枠線）。天面へ薄く敷く 1 枚の透過プレーンで、52 枚ぶんの枠を描く
//----------------------------------------------------------------------------------------------------

export function BoardGuide3D(unit) {
    const width = BOARD.cols * BOARD.cellX;
    const depth = BOARD.rows * BOARD.cellZ;
    const mesh = xthree.add(new THREE.Mesh(
        new THREE.PlaneGeometry(width, depth),
        new THREE.MeshBasicMaterial({ map: makeGuideTexture(), transparent: true, depthWrite: false }),
    ));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(0, SURFACE_Y + 0.001, 0);
}

//----------------------------------------------------------------------------------------------------
// Card3D — 場に置く 3D カード 1 枚（薄い箱 + 数字とスートのテクスチャ）
//----------------------------------------------------------------------------------------------------

export function Card3D(unit, { suit, rank }) {
    const { x, z } = cardWorld(suit, rank);
    const mesh = xthree.add(new THREE.Mesh(
        new THREE.BoxGeometry(CARD.w, CARD.thickness, CARD.length),
        cardMaterials(makeCardFaceTexture(suit, rank)),
    ));
    mesh.position.set(x, SURFACE_Y + CARD.thickness / 2 + 0.002, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
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

export function Character(unit, { mogPath, vrmaPath, x = 0, z = 0, scale = 1.1, rotY = null }) {
    const object = xthree.nest({ position: { x, y: 0, z }, scale, rotation: { x: 0, y: rotY ?? Math.atan2(-x, -z) } });

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
// テクスチャ生成（カードとマス目だけ手描き canvas。畳・木目は xtextures で焼く）
//----------------------------------------------------------------------------------------------------

function cssColor(color) {
    return `#${color.toString(16).padStart(6, '0')}`;
}

// カードの表面（左上のランク + 中央の大きなスート）
function makeCardFaceTexture(suit, rank) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 180;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#faf8f2';
    ctx.fillRect(0, 0, 128, 180);
    ctx.strokeStyle = '#d8d2c4';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, 120, 172);

    ctx.fillStyle = cssColor(SUIT_COLORS[suit]);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText(RANK_LABELS[rank], 12, 8);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 78px sans-serif';
    ctx.fillText(SUIT_MARKS[suit], 74, 118);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
}

// 場のマス目（透過 canvas に 4x13 の枠。7 の列だけ濃くして起点を示す）
function makeGuideTexture() {
    const cell = 48;
    const canvas = document.createElement('canvas');
    canvas.width = BOARD.cols * cell;
    canvas.height = BOARD.rows * cell;
    const ctx = canvas.getContext('2d');
    ctx.lineWidth = 2;
    for (let row = 0; row < BOARD.rows; row++) {
        for (let col = 0; col < BOARD.cols; col++) {
            const seven = col === 6;
            ctx.strokeStyle = seven ? 'rgba(70, 50, 30, 0.55)' : 'rgba(70, 50, 30, 0.22)';
            ctx.strokeRect(col * cell + 5, row * cell + 3, cell - 10, cell - 6);
        }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
}
