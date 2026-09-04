//----------------------------------------------------------------------------------------------------
// three_table — 四畳半（半畳を中心に置いた風車敷き）の畳と、その上のちゃぶ台。
//   畳・ちゃぶ台・カーペットは xthree.models の基本モデル（引数なしなら既定値）。畳は grid: [3, 3]（半畳単位）
//   を渡すだけで四畳半に敷かれる。座布団とキャラ（wip/cat_king の移植）はこの例のローカル。
//----------------------------------------------------------------------------------------------------

import { xnew, xbasics } from '@mulsense/xnew';
import { xthree } from '@mulsense/xnew/addons/xthree';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin } from '@pixiv/three-vrm';
import { VRMAnimationLoaderPlugin, createVRMAnimationClip } from '@pixiv/three-vrm-animation';
import voxelkit from 'voxelkit';

// 寸法はすべて「畳の短辺 = 1」を単位にした切りのいい値（四畳半は 3 x 3 = 3 四方）
const MAT = 1;                  // 畳の短辺。長辺は 2 倍、半畳は正方形
const MAT_THICKNESS = 0.06;     // 畳の厚み。畳は y=0 から上へ積まれるので、畳表はこの高さ

// ちゃぶ台。半径だけは四畳半が隠れないよう詰めてある
const TABLE_RADIUS = 0.7;       // 天板の半径
const TABLE_THICKNESS = 0.07;   // 天板の厚み（側面の高さ）
const TABLE_TOP_Y = 0.25;       // 天面の高さ（座卓）
const TABLE_LEG_RADIUS = 0.03;  // 脚の半径（上端。下端はモデル側で少し太くなる）

// カーペット: 畳の下に敷く一枚もの。ドラッグ回転でもホイールで引いても縁が入らないよう、四畳半より広く取る
const CARPET_SIZE = 30;         // 四畳半（3 x 3）に対して十分広い。引き切って 45° 回しても角が画面に入らない幅
const CARPET_TILE = 2;          // 焼くタイル 1 枚ぶんの実寸。これを繰り返して敷き詰める
const CARPET_SOLID = 2.5;       // ここまでは不透明。四畳半（対角 2.1）とキャラがちょうど収まる半径
const CARPET_CLEAR = 5;         // ここで透明になり切る。既定のカメラだと画面の外周が淡く白へ抜ける

// ちゃぶ台を囲む .mog ボクセルキャラ（VRM に変換して読み込む）
const CHARACTERS = [
    { mog: 'zundamon', angle: 0 },
    { mog: 'itako', angle: Math.PI / 2 },
    { mog: 'zunko', angle: Math.PI },
    { mog: 'kiritan', angle: -Math.PI / 2 },
];
const VRMA = '../../assets/walk.vrma';

xnew(document.querySelector('#main'), Main);

//----------------------------------------------------------------------------------------------------
// Main — Screen + three をセットアップし、ライト / カーペット / 畳 / ちゃぶ台を並べる。ドラッグで回転・ホイールでズーム。
//----------------------------------------------------------------------------------------------------

function Main(unit, { size = 1024 } = {}) {
    xnew.protect();
    xnew.extend(xbasics.Screen, { width: size, height: size });

    // 望遠ぎみ（低 FOV + カメラを引く）でパースを弱め、畳の目地の歪みを抑える
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 4.5, 6);
    camera.lookAt(0, -0.4, 0);   // 少し下を狙って、四畳半が画面の中央に収まるようにする
    xthree.initialize({ canvas: unit.canvas, camera });
    xthree.renderer.shadowMap.enabled = true;
    xthree.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    xnew.promise(unit).then(() => {
        unit.on('update', () => xthree.renderer.render(xthree.scene, xthree.camera));

        xnew(Lights);
        // 床面（y=0）にそのまま敷く = 畳がこの上に載る。外周は透明へ落として、canvas 越しにページの白へ溶かす
        xnew(xthree.models.Carpet, {
            size: CARPET_SIZE, tile: CARPET_TILE,
            fade: { solid: CARPET_SOLID, clear: CARPET_CLEAR },
        });
        // 3 x 3 半畳 = 四畳半。風車敷きも畳ごとの模様の振り分けもモデル側がやる
        xnew(xthree.models.Tatami, { size: MAT, grid: [3, 3], thickness: MAT_THICKNESS });
        xnew(xthree.models.Chabudai, {
            radius: TABLE_RADIUS, thickness: TABLE_THICKNESS, height: TABLE_TOP_Y, legRadius: TABLE_LEG_RADIUS,
            position: { x: 0, y: MAT_THICKNESS, z: 0 },   // 畳表の上に置く
        });
        CHARACTERS.forEach(({ mog, angle }) => {
            const radius = TABLE_RADIUS + 0.15;   // 天板の縁のすぐ外側
            const x = Math.sin(angle) * radius, z = Math.cos(angle) * radius;
            xnew(Zabuton, { x, z, angle });
            xnew(Character, { mogPath: `../../assets/${mog}.mog`, x, z, y: MAT_THICKNESS + ZABUTON_THICKNESS });
        });
    });

    // ドラッグでシーンを回す / ホイールでカメラを寄せる
    unit.on('touchstart contextmenu wheel', ({ event }) => event.preventDefault());
    unit.on('dragmove', ({ delta }) => { xthree.scene.rotation.y += delta.x * 0.008; });
    unit.on('wheel', ({ delta }) => {
        const next = camera.position.length() * (1 + delta.y * 0.001);
        camera.position.setLength(Math.min(12, Math.max(2, next)));
    });
}

//----------------------------------------------------------------------------------------------------
// Lights — 斜め上からの主光源（影を落とす）と、全体を持ち上げる環境光
//----------------------------------------------------------------------------------------------------

function Lights(unit) {
    const dir = xthree.add(new THREE.DirectionalLight(0xfff2e0, 1.1));
    dir.position.set(1.5, 6, 2.5);
    dir.castShadow = true;
    dir.shadow.mapSize.set(4096, 4096);
    // 視錐台は四畳半＋キャラがぎりぎり入る範囲まで絞る（4096 で 1 テクセル ≒ 1mm、深度も near/far で詰めて精度を稼ぐ）
    Object.assign(dir.shadow.camera, { left: -2.5, right: 2.5, top: 2.5, bottom: -2.5, near: 3, far: 10 });
    dir.shadow.camera.updateProjectionMatrix();
    // bias はごく小さく: 大きいとボクセルの凹み（数 cm）の自己影まで消える（normalBias も同じ理由で使わない）
    dir.shadow.bias = -0.0001;

    xthree.add(new THREE.AmbientLight(0xffffff, 0.95));
    xthree.add(new THREE.HemisphereLight(0xffffff, 0x6b5a44, 0.75));
}

//----------------------------------------------------------------------------------------------------
// Zabuton — キャラが乗るグレーの座布団。角と上下の縁を丸めた箱で、綿の入ったふくらみを出す
//----------------------------------------------------------------------------------------------------

const ZABUTON_SIZE = 0.4;                       // 一辺（畳の短辺の 0.4 倍）
const ZABUTON_THICKNESS = 0.05;                 // 厚み。この高さぶんキャラを持ち上げる
const ZABUTON_CORNER = ZABUTON_SIZE * 0.2;      // 角の丸み
const ZABUTON_BEVEL = ZABUTON_THICKNESS * 0.3;  // 上下の縁の丸み。取りすぎると座布団というより丸クッションになる

function Zabuton(unit, { x, z, angle }) {
    const material = new THREE.MeshStandardMaterial({ color: 0x495266, roughness: 0.95 });
    const mesh = xthree.add(new THREE.Mesh(makeZabutonGeometry(), material));
    mesh.rotation.y = angle;
    mesh.position.set(x, MAT_THICKNESS + ZABUTON_THICKNESS / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
}

// 輪郭は面取りぶん内側に取り、ベベルで最大幅が一辺ちょうどになるようにする（Tatami と同じ作り）
function makeZabutonGeometry() {
    const h = ZABUTON_SIZE / 2 - ZABUTON_BEVEL, r = ZABUTON_CORNER;
    const shape = new THREE.Shape()
        .moveTo(-h + r, -h)
        .lineTo(h - r, -h).absarc(h - r, -h + r, r, -Math.PI / 2, 0, false)
        .lineTo(h, h - r).absarc(h - r, h - r, r, 0, Math.PI / 2, false)
        .lineTo(-h + r, h).absarc(-h + r, h - r, r, Math.PI / 2, Math.PI, false)
        .lineTo(-h, -h + r).absarc(-h + r, -h + r, r, Math.PI, Math.PI * 1.5, false);
    const geometry = new THREE.ExtrudeGeometry(shape, {
        curveSegments: 8, depth: ZABUTON_THICKNESS - 2 * ZABUTON_BEVEL,
        bevelEnabled: true, bevelSegments: 4, bevelOffset: 0,
        bevelSize: ZABUTON_BEVEL, bevelThickness: ZABUTON_BEVEL,
    });
    geometry.rotateX(-Math.PI / 2);   // 押し出し方向(+z) を上(+y) へ倒す
    geometry.center();
    return geometry;
}

//----------------------------------------------------------------------------------------------------
// Character — .mog を VRM に変換して読み込み、歩きモーション（VRMA）をループ。ちゃぶ台の中央を向いて立つ
//----------------------------------------------------------------------------------------------------

function Character(unit, { mogPath, x = 0, z = 0, y = 0, scale = 1 }) {
    const object = xthree.nest({ position: { x, y, z }, scale, rotation: { x: 0, y: Math.atan2(-x, -z) } });   // ちゃぶ台の中央を向く

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
            object.position.y = y + Math.abs(Math.sin(clock.elapsedTime * 5)) * 0.03;   // その場足踏み
        });
    });
}
