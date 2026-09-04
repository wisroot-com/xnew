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
// ちゃぶ台は wip/cat_king と同じ「畳の短辺 = 1」基準の比率。半径だけは四畳半が隠れないよう 1.2 から詰めた
const TABLE_RADIUS = 0.72 * MAT;     // 天板の半径（直径 1.27m）
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
        xnew(Carpet);
        xnew(Floor);
        xnew(Chabudai);
        CHARACTERS.forEach(({ mog, angle }) => {
            const radius = TABLE_RADIUS + 0.12;
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
    const dir = xthree.add(new THREE.DirectionalLight(0xfff2e0, 1.1));
    dir.position.set(2, 4, 3);
    dir.castShadow = true;
    dir.shadow.mapSize.set(4096, 4096);
    // 視錐台は四畳半＋キャラがぎりぎり入る範囲まで絞る（1 テクセル ≒ 1mm、深度も near/far で詰めて精度を稼ぐ）
    Object.assign(dir.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2, near: 3, far: 9 });
    dir.shadow.camera.updateProjectionMatrix();
    // bias はごく小さく: 大きいとボクセルの凹み（数 cm）の自己影まで消える（normalBias も同じ理由で使わない）
    dir.shadow.bias = -0.0001;

    xthree.add(new THREE.AmbientLight(0xffffff, 0.95));
    xthree.add(new THREE.HemisphereLight(0xffffff, 0x6b5a44, 0.75));
}

//----------------------------------------------------------------------------------------------------
// Carpet — 畳の下に敷く一枚もの。ドラッグ回転でもホイールで引いても縁が入らないよう、四畳半より広く取る
//----------------------------------------------------------------------------------------------------

const CARPET_SIZE = 30 * MAT;   // 四畳半（3x3 畳）に対して十分広い。引き切って 45° 回しても角が画面に入らない幅
const CARPET_TILE = 2 * MAT;    // 焼くタイル 1 枚ぶんの実寸。これを繰り返して敷き詰める

const CARPET_SOLID = 2.0;       // ここまでは不透明。四畳半（対角 1.9）とキャラがちょうど収まる半径
const CARPET_FADE = 4.4;        // ここで透明になり切る。既定のカメラだと画面の外周が淡く白へ抜ける

function Carpet(unit) {
    const material = xthree.material.standard(xtextures.carpet, {
        size: { width: 1024, height: 1024 }, worldSize: CARPET_TILE, params: xtextures.carpet.presets.standard,
        tile: true, repeat: { x: CARPET_SIZE / CARPET_TILE, y: CARPET_SIZE / CARPET_TILE },
        roughness: 1,
        // 外周を透明へ落として、canvas 越しにページの白へ溶かす（canvas は透過なので背景の白がそのまま出る）
        transparent: true, alphaMap: makeFadeAlpha(),
    });
    const mesh = xthree.add(new THREE.Mesh(new THREE.PlaneGeometry(CARPET_SIZE, CARPET_SIZE), material));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = -MAT_THICKNESS;   // 畳の裏と同じ高さ = 畳がそのまま上に載る
    mesh.receiveShadow = true;
}

// 中心が不透明・外周が透明の放射グラデーション。敷き詰める map と違い、alphaMap は板 1 枚へ 1 回だけ貼る
function makeFadeAlpha(size = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const half = CARPET_SIZE / 2;
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, '#fff');
    gradient.addColorStop(CARPET_SOLID / half, '#fff');
    gradient.addColorStop(CARPET_FADE / half, '#000');
    gradient.addColorStop(1, '#000');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(canvas);
}

//----------------------------------------------------------------------------------------------------
// Floor — 四畳半ぶんの畳を LAYOUT どおりに敷く。畳ごとに seed を変えて、同じ模様が並ばないようにする
//----------------------------------------------------------------------------------------------------

function Floor(unit) {
    LAYOUT.forEach((mat, index) => xnew(Mat, { ...mat, seed: index * 13 }));
}

//----------------------------------------------------------------------------------------------------
// Mat — 畳 1 枚。tatami のセルは正方形なので、1 セルだけ焼いた map を実寸 (aspect x 1) の箱の天面へ貼る
//----------------------------------------------------------------------------------------------------

const MAT_THICKNESS = 0.06 * MAT;           // 畳の厚み（実寸 53mm 相当）。天面を y=0 に保ちたいので下へ伸ばす
const MAT_CHAMFER = MAT_THICKNESS * 0.15;   // 天面と側面の境の面取り。直角のままだと縁が刃物のように立つ

function Mat(unit, { x, z, aspect, turned, seed }) {
    const material = xthree.material.standard(xtextures.tatami, {
        params: { scale: MAT, aspect, seed },
        worldSize: MAT,                                  // scale と同じ = 畳ちょうど 1 枚ぶんを焼く
        size: { width: 512 * aspect, height: 512 },      // 長辺ぶん横に伸ばして解像度を合わせる
        roughness: 1,
    });
    const mesh = xthree.add(new THREE.Mesh(makeMatGeometry(MAT * aspect), material));
    mesh.rotation.y = turned ? Math.PI / 2 : 0;
    mesh.position.set(x * MAT, -MAT_THICKNESS / 2, z * MAT);
    mesh.receiveShadow = true;
    mesh.castShadow = true;   // 四畳半の外周の厚みがカーペットへ落ちる
}

// 上下の縁を面取りした箱。輪郭は面取りぶん内側に取り、ベベルで最大幅が実寸ちょうどになるようにする
function makeMatGeometry(length) {
    const hx = length / 2 - MAT_CHAMFER, hz = MAT / 2 - MAT_CHAMFER;
    const shape = new THREE.Shape()
        .moveTo(-hx, -hz).lineTo(hx, -hz).lineTo(hx, hz).lineTo(-hx, hz).lineTo(-hx, -hz);
    const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: MAT_THICKNESS - 2 * MAT_CHAMFER,
        bevelEnabled: true, bevelSegments: 1, bevelOffset: 0,
        bevelSize: MAT_CHAMFER, bevelThickness: MAT_CHAMFER,
    });
    geometry.rotateX(-Math.PI / 2);   // 押し出し方向(+z) を上(+y) へ倒す
    geometry.center();
    applyMatUv(geometry, length);
    return geometry;
}

// 天面と同じ畳テクスチャを面ごとに貼り分ける（側面用の単色マテリアルを持たないので、ヘリの色や幅を
// 変えると側面もそのまま追従する）。ExtrudeGeometry は非インデックスなので法線で面を判別できる。
function applyMatUv(geometry, length) {
    const position = geometry.attributes.position;
    const normal = geometry.attributes.normal;
    const uv = geometry.attributes.uv;
    for (let i = 0; i < position.count; i++) {
        const x = position.getX(i), z = position.getZ(i);
        const depth = 0.5 - position.getY(i) / MAT_THICKNESS;        // 0 = 天面側 / 1 = 裏側
        if (Math.abs(normal.getY(i)) > 0.3) {
            // 天面・裏面と面取り: 平面投影。畳表がそのまま面取りへ回り込み、ヘリも縁を巻いて続く
            uv.setXY(i, 0.5 + x / length, 0.5 - z / MAT);
        } else if (Math.abs(normal.getX(i)) > Math.abs(normal.getZ(i))) {
            // 短辺: テクスチャの v 軸（＝短辺方向）をなぞるので、両端にヘリが乗る。
            // u は継ぎ目の陰を避けて端の少し内側。厚み方向へわずかに振るのは normalMap の接空間を潰さないため
            const u = normal.getX(i) > 0 ? 0.97 - 0.02 * depth : 0.03 + 0.02 * depth;
            uv.setXY(i, u, 0.5 - z / MAT);
        } else {
            // 長辺: ヘリの帯（v が 0 / 1 の側）の中を長辺方向へなぞる
            const v = normal.getZ(i) > 0 ? 0.006 + 0.01 * depth : 0.994 - 0.01 * depth;
            uv.setXY(i, 0.5 + x / length, v);
        }
    }
    uv.needsUpdate = true;
}

//----------------------------------------------------------------------------------------------------
// Chabudai — 円形ちゃぶ台（天板 + 折れ脚）。木目は xtextures.wood を檜風の淡い色で焼いたマテリアル
//----------------------------------------------------------------------------------------------------

function Chabudai(unit) {
    const group = xthree.nest();

    // 天板: 縁を丸めた円盤（側面=横木目 / 天面=年輪 / 底面=無地）。天面・側面とも同じ木目パラメータで焼く
    const sideMaterial = xthree.material.standard(xtextures.wood, {          // 側面（横長 canvas で木目が横に流れる）
        size: { width: 512, height: 64 }, worldSize: 1.5, params: WOOD_PARAMS,
        tile: true, repeat: { x: 3, y: 1 },   // 周方向に 3 回シームレスにタイルして木目を細かく
        roughness: 0.65,
    });
    const faceMaterial = xthree.material.standard(xtextures.wood, {          // 天面
        size: { width: 512, height: 512 }, worldSize: 1.5, params: WOOD_PARAMS,
        roughness: 0.55,
    });
    const backMaterial = new THREE.MeshStandardMaterial({ color: 0xcab6a2, roughness: 0.7 });   // 底面

    // 天面・底面は平面 UV（年輪）を保ちたいので円柱ひとつにせず、丸めた側面 + 円盤 2 枚に分ける
    const top = new THREE.Group();
    top.position.y = TABLE_TOP_Y;
    group.add(top);

    // 側面: 上下の縁を 1/4 円で丸めた輪郭を回す。Lathe の v は点の index 割りなので直線部も分割して木目の伸びを揃える
    const EDGE = TABLE_THICKNESS * 0.35;             // 縁の丸みの半径
    const capRadius = TABLE_RADIUS - EDGE;
    const profile = [];
    for (let i = 0; i <= 4; i++) {                   // 下の縁（-90°→0°）
        const t = -Math.PI / 2 + Math.PI / 2 * (i / 4);
        profile.push(new THREE.Vector2(capRadius + EDGE * Math.cos(t), -TABLE_THICKNESS / 2 + EDGE + EDGE * Math.sin(t)));
    }
    profile.push(new THREE.Vector2(TABLE_RADIUS, 0));
    for (let i = 0; i <= 4; i++) {                   // 上の縁（0°→90°）
        const t = Math.PI / 2 * (i / 4);
        profile.push(new THREE.Vector2(capRadius + EDGE * Math.cos(t), TABLE_THICKNESS / 2 - EDGE + EDGE * Math.sin(t)));
    }
    const side = new THREE.Mesh(new THREE.LatheGeometry(profile, 64), sideMaterial);
    side.castShadow = true;
    side.receiveShadow = true;
    top.add(side);

    const face = new THREE.Mesh(new THREE.CircleGeometry(capRadius, 64), faceMaterial);
    face.rotation.x = -Math.PI / 2;
    face.position.y = TABLE_THICKNESS / 2;
    face.castShadow = true;
    face.receiveShadow = true;
    top.add(face);

    const back = new THREE.Mesh(new THREE.CircleGeometry(capRadius, 64), backMaterial);
    back.rotation.x = Math.PI / 2;
    back.position.y = -TABLE_THICKNESS / 2;
    back.castShadow = true;
    top.add(back);

    // 脚: 天板の下に垂直に立てた 4 本。木目の傾きを保ったまま +90° して縦木目にする
    const legMaterial = xthree.material.standard(xtextures.wood, {
        size: { width: 128, height: 256 }, worldSize: 1, params: { ...WOOD_PARAMS, angle: WOOD_PARAMS.angle + 90 },
        roughness: 0.6,
    });
    const legHeight = TABLE_TOP_Y - TABLE_THICKNESS / 2;   // 床から天板の裏まで
    for (let i = 0; i < 4; i++) {
        const angle = Math.PI / 4 + i * Math.PI / 2;
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.032 * MAT, 0.039 * MAT, legHeight, 16), legMaterial);
        const r = TABLE_RADIUS * 0.85;   // 円の外側寄りに配置
        leg.position.set(Math.cos(angle) * r, legHeight / 2, Math.sin(angle) * r);
        leg.castShadow = true;
        group.add(leg);
    }
}

//----------------------------------------------------------------------------------------------------
// Character — .mog を VRM に変換して読み込み、歩きモーション（VRMA）をループ。ちゃぶ台の中央を向いて立つ
//----------------------------------------------------------------------------------------------------

function Character(unit, { mogPath, x = 0, z = 0, scale = 0.85 }) {
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
