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

import { xnew } from '../../src/index';
import { xthree } from '../../src/addons/xthree';

function setup() {
    const canvas = document.createElement('canvas');
    return canvas;
}

test('nest: 親ユニットの nest が子ユニットの nest の親になる（入れ子が機能する）', () => {
    const canvas = setup();
    let group, mesh, scene;

    xnew(() => {
        xthree.initialize({ canvas });
        scene = xthree.scene;
        xnew(() => {                  // 親ユニット
            group = xthree.nest();
            xnew(() => {              // 子ユニット
                mesh = xthree.nest();
            });
        });
    });

    expect(group.parent).toBe(scene);
    expect(mesh.parent).toBe(group);
});

test('nest: 同一ユニットで2回呼ぶと2回目は1回目の子になる（状態を変える）', () => {
    const canvas = setup();
    let a, b, scene;

    xnew(() => {
        xthree.initialize({ canvas });
        scene = xthree.scene;
        a = xthree.nest();
        b = xthree.nest();
    });

    expect(a.parent).toBe(scene);
    expect(b.parent).toBe(a);
});

test('add: 現在の親に追加するが親を変えない（同一ユニットで複数 add しても兄弟）', () => {
    const canvas = setup();
    const a = new THREE.Object3D();
    const b = new THREE.Object3D();
    let scene;

    xnew(() => {
        xthree.initialize({ canvas });
        scene = xthree.scene;
        xthree.add(a);
        xthree.add(b);
    });

    expect(a.parent).toBe(scene);
    expect(b.parent).toBe(scene);
});

test('add: nest の中の add は nest の親に入り、後続の nest を汚染しない', () => {
    const canvas = setup();
    const added = new THREE.Object3D();
    let group, nested;

    xnew(() => {
        xthree.initialize({ canvas });
        xnew(() => {
            group = xthree.nest();
            xnew(() => { xthree.add(added); });   // group の子になる
            xnew(() => { nested = xthree.nest(); }); // group の子（add に影響されない）
        });
    });

    expect(added.parent).toBe(group);
    expect(nested.parent).toBe(group);
});

test('nest: options で新しいグループの transform を設定できる（position / scale / rotation、z 任意）', () => {
    const canvas = setup();
    let group;

    xnew(() => {
        xthree.initialize({ canvas });
        group = xthree.nest({
            position: { x: 1, y: 2, z: 3 },
            scale: 2,
            rotation: { x: 0.1, y: 0.2 },
        });
    });

    expect(group.position.x).toBe(1);
    expect(group.position.y).toBe(2);
    expect(group.position.z).toBe(3);
    expect(group.scale.x).toBe(2);
    expect(group.scale.y).toBe(2);
    expect(group.scale.z).toBe(2);
    expect(group.rotation.x).toBe(0.1);
    expect(group.rotation.y).toBe(0.2);
    expect(group.rotation.z).toBe(0); // z 省略時は 0
});

test('finalize: ユニット破棄で親から外れる', () => {
    const canvas = setup();
    const obj = new THREE.Object3D();
    let scene;
    let child;

    xnew(() => {
        xthree.initialize({ canvas });
        scene = xthree.scene;
        child = xnew(() => { xthree.add(obj); });
    });

    expect(obj.parent).toBe(scene);
    child.finalize();
    expect(obj.parent).toBe(null);
});

test('finalize: ユニット破棄で renderer が dispose / forceContextLoss される（自動解放）', () => {
    const canvas = setup();
    let disposeSpy;
    let lossSpy;

    const root = xnew(() => {
        xthree.initialize({ canvas });
        disposeSpy = jest.spyOn(xthree.renderer, 'dispose');
        lossSpy = jest.spyOn(xthree.renderer, 'forceContextLoss');
    });
    root.finalize();

    expect(disposeSpy).toHaveBeenCalled();
    expect(lossSpy).toHaveBeenCalled();
});

test('finalize: ユニット破棄では dispose しない（共有リソース保護）', () => {
    const canvas = setup();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());

    const geoSpy = jest.spyOn(mesh.geometry, 'dispose');
    const matSpy = jest.spyOn(mesh.material, 'dispose');

    let child;
    xnew(() => {
        xthree.initialize({ canvas });
        child = xnew(() => { xthree.add(mesh); });
    });
    child.finalize();

    expect(mesh.parent).toBe(null);
    expect(geoSpy).not.toHaveBeenCalled();
    expect(matSpy).not.toHaveBeenCalled();
});
