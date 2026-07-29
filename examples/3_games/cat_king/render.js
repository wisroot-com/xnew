//----------------------------------------------------------------------------------------------------
// render — ブラウザ専用のグラフィックス束（Pixi / Three / xtextures）。
//   game.js は server(Node) と client(browser) の両方で評価されるため Pixi/Three を静的 import できない。
//   そこで browser 専用のこのファイルへ集約し、index.js が window.gfx に載せて game.js の client 分岐へ渡す
//   （io を window.io で渡すのと同じ流儀）。Node はこのファイルを一切読み込まない。
//   3D の見た目（畳の床・円形ちゃぶ台）は 3_games/card から移植。盤・トークン・選択ピンはこのゲーム専用の
//   プリミティブ組み立て（.mog などの外部モデルは使わない）。
//----------------------------------------------------------------------------------------------------

import { xnew, xbasics, xtextures } from '@mulsense/xnew';
import { xpixi } from '@mulsense/xnew/addons/xpixi';
import { xthree } from '@mulsense/xnew/addons/xthree';
import * as PIXI from 'pixi.js';
import * as THREE from 'three';

// テーブル寸法と盤のマス寸法（トークンやピンの配置に使うので game.js からも参照する）
const TABLE = { RADIUS: 1.2, THICKNESS: 0.07, TOP_Y: 0.25 };
const SURFACE_Y = TABLE.TOP_Y + TABLE.THICKNESS / 2;   // 天面の高さ
const CELL = 0.3;                                      // 盤のマス一辺（world）
const BOARD_TOP = SURFACE_Y + 0.012;                   // 盤の板の上面（トークンの足元）

export const Screen = xbasics.Screen;
export { xpixi, xthree, PIXI, THREE, TABLE, BOARD_TOP };

// 手札カードのイラスト（assets/ の生成画像 864x1216）。読み込みは非同期 —
// 未ロードの間 makeHandCard は無地カードで描き、次の再構築で画像に置き換わる。
export const cardTextures = {};
{
    const files = {
        'cat:v': 'direction_cat_v.png', 'cat:h': 'direction_cat_h.png',
        'det:v': 'direction_detective_v.png', 'det:h': 'direction_detective_h.png',
        'sanma:v': 'direction_sanma_v.png', 'sanma:h': 'direction_sanma_h.png',
        'label:cat': 'label_cat.png', 'label:det': 'label_detective.png',
    };
    for (const [card, file] of Object.entries(files)) {
        PIXI.Assets.load(`/assets/${file}`).then((texture) => { cardTextures[card] = texture; });
    }
}

// ワールド 3D 座標を canvas 2D 座標へ写す（ピンの当たり判定など 2D オーバーレイの位置合わせ用）
export function coord3dTo2d(x, y, z) {
    const camera = xthree.camera;
    camera.updateMatrixWorld();
    const projected = new THREE.Vector3(x, y, z).project(camera);
    return new THREE.Vector2((projected.x + 1) / 2 * xthree.canvas.width, (1 - projected.y) / 2 * xthree.canvas.height);
}

// マス番号(0..8) → 盤上の world 座標（列=x、行=z。北=行 0 が奥）
export function cellToWorld(cell, dx = 0, dz = 0) {
    return { x: (cell % 3 - 1) * CELL + dx, z: (Math.floor(cell / 3) - 1) * CELL + dz };
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
// BoardPlate — 天面に置く 3x3 の盤（升目を描いた紙風テクスチャの薄い板）
//----------------------------------------------------------------------------------------------------

export function BoardPlate(unit) {
    const size = CELL * 3 + 0.08;                       // 升目の外に少し余白
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const scale = 512 / size;
    const margin = (size - CELL * 3) / 2 * scale;
    ctx.fillStyle = '#f2ead6';
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = '#8a7a5c';
    ctx.lineWidth = 5;
    for (let i = 0; i <= 3; i++) {
        const p = margin + i * CELL * scale;
        ctx.beginPath(); ctx.moveTo(p, margin); ctx.lineTo(p, 512 - margin); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(margin, p); ctx.lineTo(512 - margin, p); ctx.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;

    // BoxGeometry のマテリアル順 [+x,-x,+y,-y,+z,-z]。上面(+y=index 2)だけ升目、他は無地の紙色
    const plain = new THREE.MeshStandardMaterial({ color: 0xd9cfae, roughness: 0.85 });
    const face = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.85 });
    const plate = xthree.add(new THREE.Mesh(new THREE.BoxGeometry(size, 0.012, size), [plain, plain, face, plain, plain, plain]));
    plate.position.y = SURFACE_Y + 0.006;
    plate.castShadow = true;
    plate.receiveShadow = true;
}

//----------------------------------------------------------------------------------------------------
// トークン移動アニメーション — group を現在位置から目標へなめらかに動かす（連続移動は前の移動を打ち切る）
//----------------------------------------------------------------------------------------------------

const LYING_Y = SURFACE_Y + 0.045;                     // 横倒し（捕獲済み）の高さ

function makeGlide(group) {
    let anim = null;
    return function glide(to) {                        // to: { x, y, z, r? (rotation.z) }
        const from = { x: group.position.x, y: group.position.y, z: group.position.z, r: group.rotation.z };
        anim?.clear();
        anim = xnew.transition(({ value }) => {
            group.position.set(from.x + (to.x - from.x) * value, from.y + (to.y - from.y) * value, from.z + (to.z - from.z) * value);
            if (to.r != null) { group.rotation.z = from.r + (to.r - from.r) * value; }
        }, 350, 'ease-in-out');
    };
}

//----------------------------------------------------------------------------------------------------
// CatToken — 猫の駒（円錐の胴 + 球の頭 + 耳）。lying は捕獲済み表現（盤の横に横倒し）。
//----------------------------------------------------------------------------------------------------

export function CatToken(unit, { color, x = 0, z = 0, lying = false }) {
    const group = xthree.nest({ position: { x, y: lying ? LYING_Y : BOARD_TOP, z } });
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.55 });
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.09, 24), material);
    body.position.y = 0.045;
    group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.034, 20, 16), material);
    head.position.y = 0.1;
    group.add(head);
    for (const side of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.013, 0.028, 12), material);
        ear.position.set(side * 0.018, 0.135, 0);
        group.add(ear);
    }
    if (lying) { group.rotation.z = Math.PI / 2; }
    group.traverse((obj) => { if (obj.isMesh) { obj.castShadow = true; } });

    const glide = makeGlide(group);
    return {
        place({ x, z, lying = false }) { glide({ x, y: lying ? LYING_Y : BOARD_TOP, z, r: lying ? Math.PI / 2 : 0 }); },
    };
}

//----------------------------------------------------------------------------------------------------
// DetectiveToken — 探偵の駒（濃紺のポーン + 帽子のつば）。猫よりひと回り背が高い。
//----------------------------------------------------------------------------------------------------

export function DetectiveToken(unit, { x = 0, z = 0 }) {
    const group = xthree.nest({ position: { x, y: BOARD_TOP, z } });
    const coat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.6 });
    const hat = new THREE.MeshStandardMaterial({ color: 0x0b0f19, roughness: 0.5 });
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.11, 24), coat);
    body.position.y = 0.055;
    group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.036, 20, 16), coat);
    head.position.y = 0.125;
    group.add(head);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.008, 24), hat);
    brim.position.y = 0.152;
    group.add(brim);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.03, 0.04, 24), hat);
    crown.position.y = 0.175;
    group.add(crown);
    group.traverse((obj) => { if (obj.isMesh) { obj.castShadow = true; } });

    const glide = makeGlide(group);
    return {
        place({ x, z }) { glide({ x, y: BOARD_TOP, z }); },
    };
}

//----------------------------------------------------------------------------------------------------
// SanmaToken — サンマの駒（横に伸ばした銀色の楕円体 + 尾びれ）
//----------------------------------------------------------------------------------------------------

export function SanmaToken(unit, { x = 0, z = 0 }) {
    const group = xthree.nest({ position: { x, y: BOARD_TOP + 0.026, z } });
    const material = new THREE.MeshStandardMaterial({ color: 0x9db3c7, roughness: 0.35, metalness: 0.55 });
    const bodyFish = new THREE.Mesh(new THREE.SphereGeometry(0.032, 20, 16), material);
    bodyFish.scale.set(2.6, 0.75, 0.9);
    group.add(bodyFish);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.05, 12), material);
    tail.rotation.z = -Math.PI / 2;
    tail.position.set(-0.095, 0, 0);
    group.add(tail);
    group.traverse((obj) => { if (obj.isMesh) { obj.castShadow = true; } });

    const glide = makeGlide(group);
    return {
        place({ x, z }) { glide({ x, y: BOARD_TOP + 0.026, z }); },
    };
}

//----------------------------------------------------------------------------------------------------
// Pin3D — 選択対象の上に浮かべるマップピン（逆さ円錐 + 球）。注目を引くよう上下にフロートする。
//----------------------------------------------------------------------------------------------------

export function Pin3D(unit, { x = 0, z = 0, color = 0xfcd34d }) {
    const baseY = BOARD_TOP + 0.24;
    const group = xthree.nest({ position: { x, y: baseY, z } });
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.35, emissive: color, emissiveIntensity: 0.35 });
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.1, 20), material);
    tip.rotation.x = Math.PI;                           // 逆さ円錐（先端が下）
    tip.position.y = 0.05;
    group.add(tip);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.042, 20, 16), material);
    ball.position.y = 0.135;
    group.add(ball);
    group.traverse((obj) => { if (obj.isMesh) { obj.castShadow = true; } });

    let t = 0;
    unit.on('update', ({ delta }) => {
        t += delta / 1000;
        group.position.y = baseY + (Math.sin(t * 4) + 1) * 0.02;
    });

    return {
        // ホバー中の候補を強調（白く光らせて少し拡大）。クリックで選ばれるピンを示す
        setActive(active) {
            material.color.set(active ? 0xffffff : color);
            material.emissive.set(active ? 0xffe58a : color);
            material.emissiveIntensity = active ? 0.9 : 0.35;
            group.scale.setScalar(active ? 1.3 : 1);
        },
    };
}
