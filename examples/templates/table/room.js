//----------------------------------------------------------------------------------------------------
// templates/table/room.js — 四畳半（半畳を中心に置いた風車敷き）の畳と、その上のちゃぶ台。
//   wip/cat_king の render.js から畳・ちゃぶ台の組み立てだけを取り出したもの（キャラ・盤・駒は無し）。
//   畳は四畳半 1 ブロックのみ。cat_king のようにブロックを繰り返して部屋を広げることはしない。
//   カメラ・画面まわりは script.js が持ち、このファイルは「部屋の中身」だけを組み立てる。
//----------------------------------------------------------------------------------------------------

import { xnew, xtextures } from '@mulsense/xnew';
import { xthree } from '@mulsense/xnew/addons/xthree';
import * as THREE from 'three';

const MAT = 0.88;                    // 畳の短辺（m）。長辺は 2 倍、半畳は正方形
// ちゃぶ台は cat_king と同じ「畳の短辺 = 1」基準の比率。半径だけは四畳半が隠れないよう 1.2 → 0.6 に詰めた
const TABLE_RADIUS = 0.6 * MAT;      // 天板の半径（直径 1.06m）
const TABLE_THICKNESS = 0.07 * MAT;  // 天板の厚み（側面の高さ）
const TABLE_TOP_Y = 0.25 * MAT;      // 天面の高さ（22cm の座卓）

// 檜風の淡い木目 = wood の hinoki プリセット
const WOOD_PARAMS = xtextures.wood.presets.hinoki;

// 四畳半の風車敷き: 中央に半畳、その周りを 4 枚が風車状に囲む（部屋は 3x3 畳単位 = 2.64m 四方）
const LAYOUT = [
    { x: 0, z: 0, aspect: 1, turned: false },            // 中央の半畳
    { x: -0.5, z: -1, aspect: 2, turned: false },        // 北
    { x: 1, z: -0.5, aspect: 2, turned: true },          // 東
    { x: 0.5, z: 1, aspect: 2, turned: false },          // 南
    { x: -1, z: 0.5, aspect: 2, turned: true },          // 西
];

//----------------------------------------------------------------------------------------------------
// Room — 部屋の中身をまとめて置く（ライト / 四畳半の床 / ちゃぶ台）
//----------------------------------------------------------------------------------------------------

export function Room(unit) {
    xnew(Lights);
    xnew(Floor);
    xnew(Chabudai);
}

//----------------------------------------------------------------------------------------------------
// Lights — 斜め上からの主光源（影を落とす）と、全体を持ち上げる環境光
//----------------------------------------------------------------------------------------------------

function Lights(unit) {
    const dir = xthree.add(new THREE.DirectionalLight(0xfff2e0, 2.0));
    dir.position.set(2, 4, 3);
    dir.castShadow = true;
    dir.shadow.mapSize.set(4096, 4096);
    // 視錐台は四畳半がぎりぎり入る範囲まで絞る（1 テクセル ≒ 1mm、深度も near/far で詰めて精度を稼ぐ）
    Object.assign(dir.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2, near: 3, far: 9 });
    dir.shadow.camera.updateProjectionMatrix();
    dir.shadow.bias = -0.0001;

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

    // 脚: 天板の下、外向きに少し開いた 4 本。木目の傾きを保ったまま +90° して縦木目にする
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
        leg.rotation.z = -Math.cos(angle) * 0.14;    // 外向きに開く
        leg.rotation.x = Math.sin(angle) * 0.14;
        leg.castShadow = true;
        group.add(leg);
    }
}
