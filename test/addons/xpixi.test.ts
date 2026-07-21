// @ts-nocheck
// pixi.js は ESM 依存(earcut 等)を引き込み jest で transform できないため、nest/add の検証に必要な
// 最小限（Container の親子・破棄、autoDetectRenderer）だけをモックする。
jest.mock('pixi.js', () => {
    class Container {
        constructor() { this.parent = null; this.children = []; this.destroyed = false; }
        addChild(o) { o.parent = this; this.children.push(o); return o; }
        removeChild(o) { o.parent = null; this.children = this.children.filter((c) => c !== o); return o; }
        destroy() { this.destroyed = true; }
    }
    const renderer = { render() {}, destroy() {} };
    return {
        Container,
        autoDetectRenderer: () => Promise.resolve(renderer),
        __renderer: renderer, // finalize テストで destroy を spy するため共有 renderer を公開
    };
});

// renderer は autoDetectRenderer の非同期解決後に Root へ入るため、マイクロタスクを流す。
const flush = () => new Promise((resolve) => setTimeout(resolve));

import * as PIXI from 'pixi.js';
import { xnew } from '../../src/index';
import { xpixi } from '../../src/addons/xpixi';

function setup() {
    return document.createElement('canvas');
}

test('nest: 親ユニットの nest が子ユニットの nest の親になる（入れ子が機能する）', () => {
    const canvas = setup();
    let group, child, scene;

    xnew(() => {
        xpixi.initialize({ canvas });
        scene = xpixi.scene;
        xnew(() => {
            group = xpixi.nest();
            xnew(() => { child = xpixi.nest(); });
        });
    });

    expect(group.parent).toBe(scene);
    expect(child.parent).toBe(group);
});

test('nest: 同一ユニットで2回呼ぶと2回目は1回目の子になる（状態を変える）', () => {
    const canvas = setup();
    let a, b, scene;

    xnew(() => {
        xpixi.initialize({ canvas });
        scene = xpixi.scene;
        a = xpixi.nest();
        b = xpixi.nest();
    });

    expect(a.parent).toBe(scene);
    expect(b.parent).toBe(a);
});

test('add: 現在の親に追加するが親を変えない（同一ユニットで複数 add しても兄弟）', () => {
    const canvas = setup();
    const a = new PIXI.Container();
    const b = new PIXI.Container();
    let scene;

    xnew(() => {
        xpixi.initialize({ canvas });
        scene = xpixi.scene;
        xpixi.add(a);
        xpixi.add(b);
    });

    expect(a.parent).toBe(scene);
    expect(b.parent).toBe(scene);
});

test('add: nest の中の add は nest の親に入り、後続の nest を汚染しない', () => {
    const canvas = setup();
    const added = new PIXI.Container();
    let group, nested;

    xnew(() => {
        xpixi.initialize({ canvas });
        xnew(() => {
            group = xpixi.nest();
            xnew(() => { xpixi.add(added); });
            xnew(() => { nested = xpixi.nest(); });
        });
    });

    expect(added.parent).toBe(group);
    expect(nested.parent).toBe(group);
});

test('finalize: ユニット破棄で親から外れる', () => {
    const canvas = setup();
    const obj = new PIXI.Container();
    let scene;
    let child;

    xnew(() => {
        xpixi.initialize({ canvas });
        scene = xpixi.scene;
        child = xnew(() => { xpixi.add(obj); });
    });

    expect(obj.parent).toBe(scene);
    child.finalize();
    expect(obj.parent).toBe(null);
});

test('finalize: ユニット破棄でも renderer が destroy される（自動解放）', async () => {
    const canvas = setup();
    const destroySpy = jest.spyOn(PIXI.__renderer, 'destroy');

    const root = xnew(() => { xpixi.initialize({ canvas }); });
    await flush(); // renderer 解決を待つ
    root.finalize();

    expect(destroySpy).toHaveBeenCalled();
    destroySpy.mockRestore();
});
