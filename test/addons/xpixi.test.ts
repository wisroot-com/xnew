// @ts-nocheck
// pixi.js は ESM 依存(earcut 等)を引き込み jest で transform できないため、nest/add の検証に必要な
// 最小限（Container の親子・破棄、autoDetectRenderer）だけをモックする。
jest.mock('pixi.js', () => {
    class Container {
        constructor() {
            this.parent = null; this.children = []; this.destroyed = false;
            this.position = { x: 0, y: 0, set(x, y) { this.x = x; this.y = y; } };
            this.scale = { x: 1, y: 1, set(x, y = x) { this.x = x; this.y = y; } };
            this.rotation = 0;
        }
        addChild(o) { o.parent = this; this.children.push(o); return o; }
        // 本物と同じく親を辿って canvas 座標へ。回転は使わないので position / scale だけ畳む
        toGlobal(point) {
            let at = { x: point.x, y: point.y };
            for (let node = this; node !== null; node = node.parent) {
                at = { x: at.x * node.scale.x + node.position.x, y: at.y * node.scale.y + node.position.y };
            }
            return at;
        }
        removeChild(o) { o.parent = null; this.children = this.children.filter((c) => c !== o); return o; }
        destroy() { this.destroyed = true; }
    }
    const renderer = { render() {}, destroy() {}, screen: { width: 200, height: 100 } };
    return {
        Container,
        autoDetectRenderer: () => Promise.resolve(renderer),
        __renderer: renderer, // destroy テストで destroy を spy するため共有 renderer を公開
    };
});

// renderer は autoDetectRenderer の非同期解決後に Root へ入るため、マイクロタスクを流す。
const flush = () => new Promise((resolve) => setTimeout(resolve));

// jsdom に ResizeObserver は無い。Pin は自分の大きさを測り直すためだけに使う
global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

import * as PIXI from 'pixi.js';
import { xnew } from '../../src/index';
import { xpixi } from '../../src/addons/pixi/xpixi';

function setup() {
    return document.createElement('canvas');
}

test('nest: 親ユニットの nest が子ユニットの nest の親になる（入れ子が機能する）', () => {
    const canvas = setup();
    let group, child, scene;

    xnew(() => {
        xpixi.init({ canvas });
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
        xpixi.init({ canvas });
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
        xpixi.init({ canvas });
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
        xpixi.init({ canvas });
        xnew(() => {
            group = xpixi.nest();
            xnew(() => { xpixi.add(added); });
            xnew(() => { nested = xpixi.nest(); });
        });
    });

    expect(added.parent).toBe(group);
    expect(nested.parent).toBe(group);
});

test('nest: options で新しいグループの transform を設定できる（position / scale / rotation）', () => {
    const canvas = setup();
    let group;

    xnew(() => {
        xpixi.init({ canvas });
        group = xpixi.nest({ position: { x: 10, y: 20 }, scale: 2, rotation: 0.5 });
    });

    expect(group.position.x).toBe(10);
    expect(group.position.y).toBe(20);
    expect(group.scale.x).toBe(2);
    expect(group.scale.y).toBe(2);
    expect(group.rotation).toBe(0.5);
});

test('nest: scale はオブジェクトで x / y 別々に指定できる', () => {
    const canvas = setup();
    let group;

    xnew(() => {
        xpixi.init({ canvas });
        group = xpixi.nest({ scale: { x: 3, y: 4 } });
    });

    expect(group.scale.x).toBe(3);
    expect(group.scale.y).toBe(4);
});

test('destroy: ユニット破棄で親から外れる', () => {
    const canvas = setup();
    const obj = new PIXI.Container();
    let scene;
    let child;

    xnew(() => {
        xpixi.init({ canvas });
        scene = xpixi.scene;
        child = xnew(() => { xpixi.add(obj); });
    });

    expect(obj.parent).toBe(scene);
    child.destroy();
    expect(obj.parent).toBe(null);
});

test('destroy: ユニット破棄でも renderer が destroy される（自動解放）', async () => {
    const canvas = setup();
    const destroySpy = jest.spyOn(PIXI.__renderer, 'destroy');

    const root = xnew(() => { xpixi.init({ canvas }); });
    await flush(); // renderer 解決を待つ
    root.destroy();

    expect(destroySpy).toHaveBeenCalled();
    destroySpy.mockRestore();
});

//----------------------------------------------------------------------------------------------------
// screen — 現在の親の座標を canvas に対する割合へ落とし、そこへ DOM を置く。
//   置くところは xbasics.Pin の担当（test/basics/stage/Pin.test.ts）なので、ここで見るのは
//   投影そのものと、その結果が Pin へ渡っていることだけ。
//----------------------------------------------------------------------------------------------------

test('project: 現在の親の座標を canvas に対する割合で返す', async () => {
    const canvas = setup();
    let root;
    let at;

    root = xnew(() => { xpixi.init({ canvas }); });
    await flush();   // renderer が入るまで screen の大きさが分からない

    xnew(root, () => {
        // 200x100 の画面に対し、(100, 50) はちょうど中央
        at = xpixi.project({ x: 100, y: 50 });
    });

    expect(at.x).toBeCloseTo(0.5);
    expect(at.y).toBeCloseTo(0.5);
});

test('project: nest の中では、そのグループの座標として読む', async () => {
    const canvas = setup();
    let at;

    const root = xnew(() => { xpixi.init({ canvas }); });
    await flush();

    xnew(root, () => {
        xpixi.nest({ position: { x: 100, y: 50 } });
        at = xpixi.project({ x: 0, y: 0 });   // グループの原点 = 画面の中央
    });

    expect(at.x).toBeCloseTo(0.5);
    expect(at.y).toBeCloseTo(0.5);
});

test('project: renderer が来るまでは null（Pin はそのあいだ隠れている）', () => {
    const canvas = setup();
    let at;

    xnew(() => {
        xpixi.init({ canvas });
        at = xpixi.project({ x: 0, y: 0 });
    });

    expect(at).toBeNull();
});

test('Pin: 投影した割合がそのまま left / top に届く', async () => {
    const canvas = setup();
    let pin;

    const root = xnew(() => { xpixi.init({ canvas }); });
    await flush();

    xnew(root, () => { pin = xnew(xpixi.Pin, { point: () => ({ x: 100, y: 50 }) }); });

    expect(parseFloat(pin.current.style.left)).toBeCloseTo(50);
    expect(parseFloat(pin.current.style.top)).toBeCloseTo(50);
    expect(pin.current.style.visibility).toBe('visible');
});
