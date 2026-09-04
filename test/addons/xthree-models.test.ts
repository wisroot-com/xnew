// @ts-nocheck
import * as THREE from 'three';

// jsdom には WebGL が無いので WebGLRenderer をモックする。
jest.spyOn(THREE, 'WebGLRenderer').mockImplementation(() => ({
    setClearColor() {},
    domElement: { width: 100, height: 100 },
    render() {},
    dispose() {},
    forceContextLoss() {},
}));

import { xnew, xtextures } from '../../src/index';
import { xthree } from '../../src/addons/three/xthree';

// モデルはマテリアルを必ず自前で焼く（差し替え口は無い）ので、bake だけダミー画像にすげ替える。
['wood', 'tatami', 'carpet'].forEach((name) => {
    jest.spyOn(xtextures[name], 'bake').mockReturnValue({ width: 1, height: 1 });
});

function build(Model, props) {
    const canvas = document.createElement('canvas');
    let model;
    xnew(() => {
        xthree.initialize({ canvas });
        model = xnew(Model, props);
    });
    return model.threeObject;   // nest したグループ（= モデルの中身が入っている）
}

function boundingSize(mesh) {
    mesh.geometry.computeBoundingBox();
    return mesh.geometry.boundingBox.getSize(new THREE.Vector3());
}

test('Chabudai: 天板（側面 / 天面 / 底面）と脚の本数ぶんのメッシュが並ぶ', () => {
    const group = build(xthree.models.Chabudai, {
        radius: 0.5, thickness: 0.08, height: 0.3, legs: 3, legRadius: 0.02,
    });

    expect(group.children.length).toBe(3 + 3);
    const [side, top, bottom, ...legs] = group.children;
    expect(side.position.y).toBe(0.3);
    expect(top.position.y).toBeCloseTo(0.34);      // 天面 = height + thickness / 2
    expect(bottom.position.y).toBeCloseTo(0.26);
    expect(legs.length).toBe(3);
    const legSize = boundingSize(legs[0]);
    expect(legSize.y).toBeCloseTo(0.26);        // 床から天板の裏まで
    expect(legSize.x).toBeCloseTo(0.048);       // 下端の直径（legRadius * 1.2 * 2）
});

test('Chabudai: 脚の上下の円周は面取りされている（輪郭が内側に入る）', () => {
    const group = build(xthree.models.Chabudai, { legRadius: 0.02 });

    const points = group.children[3].geometry.parameters.points;   // 旋盤の輪郭（下から上へ）
    expect(points[1].x).toBeLessThan(points[2].x);                                 // 底面の縁
    expect(points[points.length - 2].x).toBeLessThan(points[points.length - 3].x);  // 天面の縁
});

test('Chabudai: 引数なしでもデフォルト値で組み上がる', () => {
    const group = build(xthree.models.Chabudai);

    expect(group.children.length).toBe(3 + 4);   // 既定は脚 4 本
    expect(group.children[0].position.y).toBeCloseTo(0.25);
});

test('Tatami: grid は半畳単位（[1,1] 半畳 / [2,1] 一畳 / [1,2] は z 方向に長い一畳）', () => {
    const half = build(xthree.models.Tatami, { size: 1, grid: [1, 1], thickness: 0.05 });
    const full = build(xthree.models.Tatami, { size: 1, grid: [2, 1], thickness: 0.05 });
    const turned = build(xthree.models.Tatami, { size: 1, grid: [1, 2], thickness: 0.05 });

    expect(half.children.length).toBe(1);
    expect(boundingSize(half.children[0]).x).toBeCloseTo(1);

    expect(full.children.length).toBe(1);
    const fullSize = boundingSize(full.children[0]);
    expect(fullSize.x).toBeCloseTo(2);
    expect(fullSize.z).toBeCloseTo(1);
    expect(fullSize.y).toBeCloseTo(0.05);
    expect(full.children[0].rotation.y).toBe(0);

    expect(turned.children.length).toBe(1);
    expect(turned.children[0].rotation.y).toBeCloseTo(Math.PI / 2);   // z 方向へ倒す

    expect(full.children[0].position.y).toBeCloseTo(0.025);           // 裏面が y=0（厚みぶん上に載る）
});

test('Tatami: [3,3] は四畳半の風車敷き（中央が半畳、周りの 4 枚が風車状）', () => {
    const group = build(xthree.models.Tatami, { size: 1, grid: [3, 3] });

    expect(group.children.length).toBe(5);
    const halves = group.children.filter((mesh) => boundingSize(mesh).x < 1.5);
    expect(halves.length).toBe(1);
    expect(halves[0].position.x).toBeCloseTo(0);
    expect(halves[0].position.z).toBeCloseTo(0);

    // 風車: 一畳 4 枚が中心から半マスずれた位置に、縦横交互で並ぶ
    const mats = group.children.filter((mesh) => halves.includes(mesh) === false)
        .map((mesh) => [mesh.position.x, mesh.position.z, mesh.rotation.y]);
    mats.forEach(([x, z, ry]) => {
        expect(Math.abs(ry) < 0.001 ? [Math.abs(x), Math.abs(z)] : [Math.abs(z), Math.abs(x)]).toEqual([0.5, 1]);
    });
    expect(mats.filter(([, , ry]) => Math.abs(ry) < 0.001).length).toBe(2);   // 横 2 枚 / 縦 2 枚
});

test('Tatami: 六畳（[3,4]）は一畳 6 枚、四つ角が重ならないように敷かれる', () => {
    const group = build(xthree.models.Tatami, { size: 1, grid: [3, 4] });

    expect(group.children.length).toBe(6);
    group.children.forEach((mesh) => expect(boundingSize(mesh).x).toBeCloseTo(2));

    // 各畳の四隅を集めて、4 枚が集まる点（同じ点が 4 回出てくる）が無いことを確かめる
    const corners = new Map();
    group.children.forEach((mesh) => {
        const turned = Math.abs(mesh.rotation.y) > 0.001;
        const hx = turned ? 0.5 : 1, hz = turned ? 1 : 0.5;
        [[-hx, -hz], [hx, -hz], [-hx, hz], [hx, hz]].forEach(([dx, dz]) => {
            const key = `${(mesh.position.x + dx).toFixed(3)},${(mesh.position.z + dz).toFixed(3)}`;
            corners.set(key, (corners.get(key) ?? 0) + 1);
        });
    });
    expect(Math.max(...corners.values())).toBeLessThan(4);
});

// 畳ごとに seed をずらして焼く（同じ模様が並ばない）。texture で渡した値がその起点になる。
test('Tatami: texture のパラメータが bake に渡り、seed は畳ごとにずれる', () => {
    xtextures.tatami.bake.mockClear();
    build(xthree.models.Tatami, { size: 1, grid: [3, 3], texture: { seed: 100, heri: 0.08 } });

    const params = xtextures.tatami.bake.mock.calls.map(([options]) => options.params);
    expect(new Set(params.map(({ seed }) => seed)).size).toBe(5);   // 5 枚ぶん（color / normal で 2 回ずつ焼かれる）
    expect(Math.min(...params.map(({ seed }) => seed))).toBe(100);
    expect(params[0].heri).toBe(0.08);
    expect(params[0].scale).toBe(1);
});

test('Tatami: position / rotation はモデルのグループに乗る', () => {
    const group = build(xthree.models.Tatami, {
        position: { x: 1, y: 0, z: -2 },
        rotation: { x: 0, y: Math.PI / 2 },
    });

    expect(group.position.x).toBe(1);
    expect(group.position.z).toBe(-2);
    expect(group.rotation.y).toBeCloseTo(Math.PI / 2);
});

test('Zabuton: 座面 / 縁取り / 中綴じの 3 パーツが載り、top はくぼんだ天面の高さを返す', () => {
    const canvas = document.createElement('canvas');
    let zabuton;
    xnew(() => {
        xthree.initialize({ canvas });
        zabuton = xnew(xthree.models.Zabuton, { size: 0.4, thickness: 0.06 });
    });

    const group = zabuton.threeObject;
    expect(group.children.length).toBe(3);
    const [cushion, piping, knot] = group.children;

    const cushionSize = boundingSize(cushion);
    expect(cushionSize.x).toBeCloseTo(0.4);
    expect(cushionSize.z).toBeCloseTo(0.4);
    expect(cushionSize.y).toBeGreaterThan(0.055);        // 縁は薄いが、いちばん厚い部分は厚みどおり
    expect(cushionSize.y).toBeLessThan(0.06);            // 中央は中綴じでくぼむ
    expect(cushion.position.y).toBeCloseTo(0.03);        // 裏面が y=0

    expect(zabuton.top).toBeCloseTo(0.051);              // 厚み x (1 - dimple / 2)
    expect(piping.position.y).toBeCloseTo(0.03);         // 縁取りはいちばん広い縫い目の高さ
    expect(knot.position.y).toBeLessThan(zabuton.top);   // 房はくぼみに沈む
});

test('Carpet: size の正方形が xz 平面に寝る', () => {
    const group = build(xthree.models.Carpet, { size: 20, tile: 2 });

    const mesh = group.children[0];
    expect(mesh.geometry.parameters.width).toBe(20);
    expect(mesh.geometry.parameters.height).toBe(20);
    expect(mesh.rotation.x).toBeCloseTo(-Math.PI / 2);
    expect(mesh.receiveShadow).toBe(true);
});
