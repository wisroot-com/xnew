//----------------------------------------------------------------------------------------------------
// three_chabudai — three.js で立体的に組んだ円形ちゃぶ台（木目つき）と、周りに並ぶ .mog ボクセルキャラ。
//   木目は外部画像を使わず、canvas に描いた CanvasTexture で表現する（天面は横線ベースの木目、
//   側面と脚は横木目）。テーブルは天板(円柱) + 縁(トーラス) + 脚(円柱)。
//----------------------------------------------------------------------------------------------------

import { xnew, xbasics } from '@mulsense/xnew';
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
// Ground — 影を受けるだけの床（畳っぽい色）
//----------------------------------------------------------------------------------------------------

function Ground(unit) {
    const ground = xthree.add(new THREE.Mesh(
        new THREE.PlaneGeometry(40, 40),
        new THREE.MeshStandardMaterial({ map: makeTatamiTexture(), roughness: 1 }),
    ));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
}

// 畳っぽいテクスチャ: い草色の半畳マスを市松に（隣り合うマスで織り方向を変える）並べ、縁(heri)の線を入れる。
//   1 タイル = 2x2 マス。タイル境界にも縁を半分ずつ描いて、繰り返しても縁がつながるようにする（外部画像は不要）。
function makeTatamiTexture(size = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const cell = size / 2;
    const greens = ['#b7b46a', '#adb062'];   // 市松に少し色味を変える

    for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 2; c++) {
            const x0 = c * cell, y0 = r * cell;
            const horizontal = (r + c) % 2 === 0;   // 織り方向を市松で切り替え
            ctx.fillStyle = greens[(r + c) % 2];
            ctx.fillRect(x0, y0, cell, cell);

            // い草の織り目（細い平行線）
            ctx.strokeStyle = 'rgba(90, 90, 40, 0.18)';
            ctx.lineWidth = 1;
            for (let k = 2; k < cell; k += 4) {
                ctx.beginPath();
                if (horizontal) { ctx.moveTo(x0, y0 + k); ctx.lineTo(x0 + cell, y0 + k); }
                else { ctx.moveTo(x0 + k, y0); ctx.lineTo(x0 + k, y0 + cell); }
                ctx.stroke();
            }

            // 微妙なムラ
            for (let i = 0; i < 400; i++) {
                ctx.fillStyle = `rgba(70, 70, 30, ${Math.random() * 0.05})`;
                ctx.fillRect(x0 + Math.random() * cell, y0 + Math.random() * cell, 1.5, 1.5);
            }
        }
    }

    // 縁(heri): マス境界 + タイル端に濃い線。端の 0 / size 側は半分ずつ描いて繰り返し時につながる。
    ctx.strokeStyle = '#3a3524';
    ctx.lineWidth = 6;
    for (const p of [0, cell, size]) {
        ctx.beginPath();
        ctx.moveTo(p, 0); ctx.lineTo(p, size);
        ctx.moveTo(0, p); ctx.lineTo(size, p);
        ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(16, 16);   // 40x40 の床にタイル（半畳マス ≒ 1.25 単位）
    texture.anisotropy = 8;
    return texture;
}

//----------------------------------------------------------------------------------------------------
// Chabudai — 円形ちゃぶ台（天板 + 縁 + 折れ脚）。木目は canvas 生成の CanvasTexture。
//----------------------------------------------------------------------------------------------------

function Chabudai(unit) {
    const group = xthree.nest();

    const topTexture = makeWoodTopTexture();
    const sideTexture = makeWoodSideTexture();

    // 天板: 円柱（側面=横木目テクスチャ / 天面=年輪テクスチャ / 底面=無地）
    const topMaterials = [
        new THREE.MeshStandardMaterial({ map: sideTexture, roughness: 0.65 }),                        // 側面
        new THREE.MeshStandardMaterial({ map: topTexture, roughness: 0.55, metalness: 0.0 }),         // 天面
        new THREE.MeshStandardMaterial({ color: 0x9c6b3f, roughness: 0.7 }),                          // 底面
    ];
    const top = new THREE.Mesh(new THREE.CylinderGeometry(TABLE_RADIUS, TABLE_RADIUS, TABLE_THICKNESS, 64, 1), topMaterials);
    top.position.y = TABLE_TOP_Y;
    top.castShadow = true;
    top.receiveShadow = true;
    group.add(top);

    // 脚: 天板の下、外向きに少し開いた 4 本
    const legHeight = TABLE_TOP_Y - TABLE_THICKNESS / 2;   // 床から天板の裏まで
    const legMaterial = new THREE.MeshStandardMaterial({ map: makeWoodLegTexture(), roughness: 0.6 });
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

// 横線だけのシンプルな木目テクスチャ。線の間隔・太さ・色を微妙に変えて canvas に描き CanvasTexture 化する
function makeWoodTopTexture(size = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');

    // 下地（淡い木色）
    ctx.fillStyle = '#d5c096';
    ctx.fillRect(0, 0, size, size);

    // 歪みの中心点（この点を中心に、平行線を垂直方向へ押し出して歪ませる）
    const centers = [];
    const centerCount = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < centerCount; i++) {
        centers.push({
            cx: size * (0.1 + Math.random() * 0.8),
            cy: size * (0.1 + Math.random() * 0.8),
            wx: size * (0.06 + Math.random() * 0.08),    // 横方向の影響範囲
            wy: size * (0.05 + Math.random() * 0.06),    // 縦方向の影響範囲
            ampU: size * (0.008 + Math.random() * 0.014),   // 上側の押し出し量
            ampD: size * (0.008 + Math.random() * 0.014),   // 下側の押し出し量（上下で微妙に変える）
        });
    }

    // 横線（間隔・太さ・色を微妙にばらつかせつつ、中心点付近で垂直方向に歪ませる）
    for (let y = 3; y < size; y += 4 + Math.random() * 4) {
        const tint = (Math.random() - 0.5) * 24;   // 線ごとの色味差
        ctx.beginPath();
        for (let x = 0; x <= size; x += 6) {
            let dy = 0;
            for (const c of centers) {
                const ux = (x - c.cx) / c.wx;
                const uy = (y - c.cy) / c.wy;
                const amp = y < c.cy ? c.ampU : c.ampD;   // 上下で押し出し量を変える
                dy += Math.exp(-ux * ux) * Math.exp(-uy * uy) * Math.sign(y - c.cy) * amp;
            }
            const yy = y + dy;
            if (x === 0) { ctx.moveTo(x, yy); } else { ctx.lineTo(x, yy); }
        }
        ctx.strokeStyle = `rgba(${118 + tint}, ${86 + tint}, ${48 + tint}, ${0.1 + Math.random() * 0.18})`;
        ctx.lineWidth = 0.6 + Math.random() * 1.4;
        ctx.stroke();
    }

    // 歪みで開いた隙間を、その形状に合わせた入れ子の楕円状木目で埋める（線方向の細い端は埋めない）
    for (const c of centers) {
        const ringCount = 1 + Math.floor(Math.random() * 2);
        for (let ri = 1; ri <= ringCount; ri++) {
            const s = (ri / (ringCount + 1)) * 0.8;   // 内側ほど小さく（横も縦も）
            const rx = c.wx * 1.4 * s;                // 横半径（細い端まで伸ばさない）
            const tint = (Math.random() - 0.5) * 24;
            const segs = 60;
            ctx.beginPath();
            for (let i = 0; i <= segs; i++) {
                const t = (i / segs) * Math.PI * 2;
                const st = Math.sin(t);
                const ry = (st < 0 ? c.ampU : c.ampD) * s;   // 上下非対称（押し出しと同じ ampU/ampD）
                const x = c.cx + Math.cos(t) * rx;
                const y = c.cy + st * ry;
                if (i === 0) { ctx.moveTo(x, y); } else { ctx.lineTo(x, y); }
            }
            ctx.closePath();
            ctx.strokeStyle = `rgba(${118 + tint}, ${86 + tint}, ${48 + tint}, ${0.05 + Math.random() * 0.1})`;
            ctx.lineWidth = 0.6 + Math.random() * 1.4;
            ctx.stroke();
        }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
}

// 側面用: 高さ方向に積み重なる横木目（円柱側面 UV は u=周方向 / v=高さ）。周方向は RepeatWrapping でタイル。
function makeWoodSideTexture(width = 512, height = 64) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // 下地（上ふち明るめ → 下ふち暗め）
    const base = ctx.createLinearGradient(0, 0, 0, height);
    base.addColorStop(0, '#c69558');
    base.addColorStop(1, '#9a683c');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, width, height);

    // 横に走る木目（高さ方向に少しずつずらして重ねる）
    for (let y = 2; y < height; y += 2 + Math.random() * 4) {
        ctx.beginPath();
        for (let x = 0; x <= width; x += 8) {
            const yy = y + Math.sin(x * 0.03 + y) * 1.2 + (Math.random() - 0.5);
            if (x === 0) { ctx.moveTo(x, yy); } else { ctx.lineTo(x, yy); }
        }
        ctx.strokeStyle = `rgba(80, 50, 22, ${0.08 + Math.random() * 0.16})`;
        ctx.lineWidth = 0.8 + Math.random() * 1.2;
        ctx.stroke();
    }

    // 細かいノイズ
    for (let i = 0; i < 700; i++) {
        ctx.fillStyle = `rgba(70, 45, 20, ${Math.random() * 0.06})`;
        ctx.fillRect(Math.random() * width, Math.random() * height, 1.5, 1.5);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.repeat.set(3, 1);   // 周方向に 3 回タイルして木目を細かく
    texture.anisotropy = 8;
    return texture;
}

// 脚用: 長さ方向（縦）に走る木目（円柱側面 UV は u=周方向 / v=高さ）。天板より暗めの木色。
function makeWoodLegTexture(width = 128, height = 256) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#6f4a29';
    ctx.fillRect(0, 0, width, height);

    // 縦に走る木目（横方向に少しずつずらして重ねる）
    for (let x = 2; x < width; x += 2 + Math.random() * 4) {
        ctx.beginPath();
        for (let y = 0; y <= height; y += 8) {
            const xx = x + Math.sin(y * 0.04 + x) * 1.5 + (Math.random() - 0.5);
            if (y === 0) { ctx.moveTo(xx, y); } else { ctx.lineTo(xx, y); }
        }
        ctx.strokeStyle = `rgba(45, 28, 12, ${0.10 + Math.random() * 0.18})`;
        ctx.lineWidth = 0.8 + Math.random() * 1.2;
        ctx.stroke();
    }

    // 細かいノイズ
    for (let i = 0; i < 500; i++) {
        ctx.fillStyle = `rgba(40, 25, 10, ${Math.random() * 0.06})`;
        ctx.fillRect(Math.random() * width, Math.random() * height, 1.5, 1.5);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
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
