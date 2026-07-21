//----------------------------------------------------------------------------------------------------
// render — ブラウザ専用のグラフィックス束（Pixi / Three / addons / voxelkit）。
//   game.js は server(Node) と client(browser) の両方で評価されるため Pixi/Three を静的 import できない。
//   そこで browser 専用のこのファイルへ集約し、index.js が window.gfx に載せて game.js の client 分岐へ渡す
//   （io を window.io で渡すのと同じ流儀）。Node はこのファイルを一切読み込まない。
//   3D の見た目（畳の床・円形ちゃぶ台・3D カード・ボクセルキャラ）は 2_addons/three_chabudai を移植したもの。
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

// テーブル寸法（座席やカードの配置に使うので game.js からも参照する）
const TABLE = { RADIUS: 1.2, THICKNESS: 0.07, TOP_Y: 0.25 };
const SURFACE_Y = TABLE.TOP_Y + TABLE.THICKNESS / 2;   // 天面の高さ
const CARD = { w: 0.17, length: 0.25, thickness: 0.006 };

export const Screen = xbasics.Screen;
export { xpixi, xthree, PIXI, THREE, TABLE };

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
// Ground — 畳っぽい床（影を受ける）
//----------------------------------------------------------------------------------------------------

export function Ground(unit) {
    const ground = xthree.add(new THREE.Mesh(
        new THREE.PlaneGeometry(40, 40),
        new THREE.MeshStandardMaterial({ map: makeTatamiTexture(), roughness: 1 }),
    ));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
}

//----------------------------------------------------------------------------------------------------
// Chabudai — 円形ちゃぶ台（天板 + 折れ脚）。木目は canvas 生成の CanvasTexture。
//----------------------------------------------------------------------------------------------------

export function Chabudai(unit) {
    const group = xthree.nest();

    // 天板: 円柱（側面=横木目 / 天面=年輪 / 底面=無地）
    const topMaterials = [
        new THREE.MeshStandardMaterial({ map: makeWoodSideTexture(), roughness: 0.65 }),
        new THREE.MeshStandardMaterial({ map: makeWoodTopTexture(), roughness: 0.55 }),
        new THREE.MeshStandardMaterial({ color: 0x9c6b3f, roughness: 0.7 }),
    ];
    const top = new THREE.Mesh(new THREE.CylinderGeometry(TABLE.RADIUS, TABLE.RADIUS, TABLE.THICKNESS, 64, 1), topMaterials);
    top.position.y = TABLE.TOP_Y;
    top.castShadow = true;
    top.receiveShadow = true;
    group.add(top);

    // 脚: 天板の下、外向きに少し開いた 4 本
    const legHeight = TABLE.TOP_Y - TABLE.THICKNESS / 2;
    const legMaterial = new THREE.MeshStandardMaterial({ map: makeWoodLegTexture(), roughness: 0.6 });
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
    const object = xthree.nest();
    object.position.set(x, 0, z);
    object.scale.setScalar(scale);
    object.rotation.y = Math.atan2(-x, -z);   // テーブル中央を向く

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
// テクスチャ生成（すべて canvas 生成・外部画像なし）
//----------------------------------------------------------------------------------------------------

// 畳: い草色の半畳マスを市松に（隣り合うマスで織り方向を変える）並べ、縁(heri)の線を入れる。
function makeTatamiTexture(size = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const cell = size / 2;
    const greens = ['#b7b46a', '#adb062'];

    for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 2; c++) {
            const x0 = c * cell, y0 = r * cell;
            const horizontal = (r + c) % 2 === 0;
            ctx.fillStyle = greens[(r + c) % 2];
            ctx.fillRect(x0, y0, cell, cell);

            ctx.strokeStyle = 'rgba(90, 90, 40, 0.18)';
            ctx.lineWidth = 1;
            for (let k = 2; k < cell; k += 4) {
                ctx.beginPath();
                if (horizontal) { ctx.moveTo(x0, y0 + k); ctx.lineTo(x0 + cell, y0 + k); }
                else { ctx.moveTo(x0 + k, y0); ctx.lineTo(x0 + k, y0 + cell); }
                ctx.stroke();
            }
            for (let i = 0; i < 400; i++) {
                ctx.fillStyle = `rgba(70, 70, 30, ${Math.random() * 0.05})`;
                ctx.fillRect(x0 + Math.random() * cell, y0 + Math.random() * cell, 1.5, 1.5);
            }
        }
    }

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
    texture.repeat.set(16, 16);
    texture.anisotropy = 8;
    return texture;
}

// 天板の天面: 横線ベースの木目。数箇所の中心点で平行線を垂直方向に歪ませ、隙間を楕円状の木目で埋める
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

// 天板の側面: 高さ方向に積み重なる横木目
function makeWoodSideTexture(width = 512, height = 64) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    const base = ctx.createLinearGradient(0, 0, 0, height);
    base.addColorStop(0, '#c69558');
    base.addColorStop(1, '#9a683c');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, width, height);

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
    for (let i = 0; i < 700; i++) {
        ctx.fillStyle = `rgba(70, 45, 20, ${Math.random() * 0.06})`;
        ctx.fillRect(Math.random() * width, Math.random() * height, 1.5, 1.5);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.repeat.set(3, 1);
    texture.anisotropy = 8;
    return texture;
}

// 脚: 長さ方向（縦）に走る木目。天板より暗め。
function makeWoodLegTexture(width = 128, height = 256) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#6f4a29';
    ctx.fillRect(0, 0, width, height);

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
    for (let i = 0; i < 500; i++) {
        ctx.fillStyle = `rgba(40, 25, 10, ${Math.random() * 0.06})`;
        ctx.fillRect(Math.random() * width, Math.random() * height, 1.5, 1.5);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
}

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
