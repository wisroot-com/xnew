import { xnew, xbasics } from '@mulsense/xnew';
import { xpixi } from '@mulsense/xnew/addons/xpixi';
import { xthree } from '@mulsense/xnew/addons/xthree';
import * as PIXI from 'pixi.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin } from '@pixiv/three-vrm';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import html2canvas from 'html2canvas-pro';

// ずんだ因子（敵）のテーブル（添字 = 敵 id。wave N の主役 = id N-1）。
// code はターゲット表示・警告画面の識別コード / color は wave のメインカラー（黄緑・明るいこげ茶・緑・白）/
// score は撃破時の得点 / splitTo は被弾時に分裂するキャラの id（null なら分裂しない）。
const ENEMIES = [
  { file: 'zundamon.vrm', code: 'ZD-0x01', color: 0x9BE53C, score: 1, splitTo: null },
  { file: 'kiritan.vrm',  code: 'KT-0x02', color: 0xC8923C, score: 2, splitTo: 0    },
  { file: 'zunko.vrm',    code: 'ZK-0x03', color: 0x3FD96B, score: 4, splitTo: 1    },
  { file: 'itako.vrm',    code: 'IT-0x04', color: 0xFFFFFF, score: 8, splitTo: 2    },
];
// 自機は中国うさぎ（体内の免疫システム）。後ろ向きに表示する。
const PLAYER_FILE = 'usagi.vrm';

// このサンプルのアセットは examples/assets/ 配下（importmap と同じ相対基準）。
const asset = (name) => `../../assets/${name}`;

// その wave で主役になる敵 id（wave1→0 … wave4 以降はイタコ=3 で頭打ち）。
const enemyIdForWave = (wave) => Math.min(wave - 1, ENEMIES.length - 1);

// ベイク設定。フレーム数を減らすほど GPU 常駐テクスチャと起動時負荷が減る（その分コマが粗くなる）。
// 再生周期は 360 枚時代（60fps で約6秒/ループ）を保つよう BAKE_ANIMATION_SPEED で補正する。
const BAKE_FRAMES = 120;
const BAKE_ANIMATION_SPEED = BAKE_FRAMES / 360;
const BAKE_FRAME_SIZE = 96; // ベイク1フレームの解像度(px)

// 画面右端のイラスト用スペース幅(px)。ゲーム領域は x ∈ [0, PLAY_RIGHT]。
// HTML 側の 25cqw（= 200/800）と一致させること。
const PANEL_W = 200;
const PLAY_RIGHT = 800 - PANEL_W;

// リザルト画面のフッター高さ（画面高さに対する割合）。画面割り(Split)と ScreenShot のクロップで共有。
const RESULT_FOOTER_RATIO = 0.2;

// 自機⇄敵の当たり判定半径。中心間距離 < PLAYER_HIT_R + ENEMY_HIT_R で被弾。
// それぞれの半径でうっすら円を描き、円が重なる＝被弾と分かるようにする。
const PLAYER_HIT_R = 14;
const ENEMY_HIT_R = 10;

// wave のメインカラー（= その wave の主役キャラの色。endless は最後の色）。
const waveColor = (wave) => ENEMIES[enemyIdForWave(wave)].color;
const cssHex = (n) => '#' + n.toString(16).padStart(6, '0');
const waveCss = (wave) => cssHex(waveColor(wave)); // wave のメインカラー(css hex)

// 乱数ユーティリティ。いずれも Math.random() を1回だけ呼ぶ。
const randInt = (n) => Math.floor(Math.random() * n);   // 0..n-1
const pick = (arr) => arr[randInt(arr.length)];         // 配列/文字列から1つ
const randSign = () => (Math.random() < 0.5 ? 1 : -1);  // ±1
const randAngle = () => Math.random() * Math.PI * 2;    // 0..2π
const randRange = (min, max) => min + Math.random() * (max - min);

// 当たり判定の可視化円（塗り＋枠の二重描き）。
const hitCircle = (r, color, fillAlpha, strokeW, strokeAlpha) => new PIXI.Graphics()
  .circle(0, 0, r).fill({ color, alpha: fillAlpha })
  .circle(0, 0, r).stroke({ color, width: strokeW, alpha: strokeAlpha });

// 蠢く拡縮係数（生きてる感）: 1 ± amp で揺れる。
const squirmFactor = (t, phase, amp, freq) => 1 + Math.sin(t * freq + phase) * amp;

// object に半径 r 以内で最初に重なる敵へ hit(enemy) を呼ぶ（当たれば true）。vulnOnly=無敵中の敵を除外。
const hitNearestEnemy = (object, r, hit, vulnOnly = false) => {
  for (const enemy of xnew.find(Enemy)) {
    if (vulnOnly && !enemy.isVulnerable) continue;
    if (enemy.distance(object) < r) { hit(enemy); return true; }
  }
  return false;
};

// ランダムな16進文字列（len 桁）。流れる解析数字に使う。
const randHex = (len) => randInt(16 ** len).toString(16).toUpperCase().padStart(len, '0');
// 解析ストリーム/警告画面で流す「謎文字」の文字集合と、そこから n 文字。
const STREAM_CHARS = '0123456789ABCDEF<>/\\|=+*#░▒▓';
const randStream = (n, chars = STREAM_CHARS) => Array.from({ length: n }, () => pick(chars)).join('');

// ベイク済みテクスチャの AnimatedSprite を nest 直下に配置。textures 直指定か id で texturesList[id] を引く。
// frame: 'random' で開始コマをランダム化 / 数値で固定（length-1 にクランプ）。位置等は .sprite で制御。
function BakedSprite(_unit, { textures, id, scale = 1, frame, play = true } = {}) {
  const tex = textures ?? xnew.context(BakedCharacters).texturesList[id];
  const sprite = new PIXI.AnimatedSprite(tex);
  sprite.anchor.set(0.5);
  sprite.animationSpeed = BAKE_ANIMATION_SPEED;
  sprite.scale.set(scale);
  if (frame === 'random') {
    sprite.currentFrame = randInt(tex.length);
  } else if (frame !== undefined) {
    sprite.currentFrame = Math.min(frame, tex.length - 1);
  }
  if (play) {
    sprite.play();
  }
  xpixi.add(sprite);
  return { get sprite() { return sprite; } };
}

// HUD 風の四隅 L 字ブラケット（nest 直下に絶対配置で4つ）。StoryDialog / WaveTransition で共有。
// color 省略時は currentColor 継承。offset/size/borderW は cqw 単位。
function cornerBrackets({ offset = 0, size, borderW, opacity, color }) {
  for (const vside of ['top', 'bottom']) {
    for (const hside of ['left', 'right']) {
      const b = xnew(`<div class="absolute ${vside}-[${offset}cqw] ${hside}-[${offset}cqw] w-[${size}cqw] h-[${size}cqw]" style="border-${vside}:${borderW}cqw solid; border-${hside}:${borderW}cqw solid; opacity:${opacity};">`);
      if (color) {
        b.element.style.color = color;
      }
    }
  }
}

xnew(document.querySelector('#main'), Main);

function Main(unit) {
  const [width, height] = [800, 600];
  xnew.extend(xbasics.Screen, { width, height });

  xpixi.initialize({ canvas: unit.canvas });
  unit.on('update', () => xpixi.renderer.render(xpixi.scene));
  xnew(Contents);
}

function Contents(unit) {
  const assets = xnew(BakedCharacters);
  xnew.promise(assets).then(() => {
    xnew(TitleScene);
  });
}

// ---- Character baking (VRM -> AnimatedSprite textures) ----
//
// 焼き機（WebGL + EffectComposer + SSAO + ライト + カメラ）を1セットだけ作り、VRM を順に差し替えて逐次ベイク。
// 逐次化でピーク GPU を VRM 1体分に抑える（並列に焼く旧実装は GPU 圧迫の主因だった。DEVNOTES §5。起動は数百ms 長くなる）。

// VRM を読み込むだけ（シーンには追加しない。GPU アップロードはベイク時まで遅延）。
// xnew.promise('model', ...) で登録 → xnew.promise('vrms[]', xnew(VRMLoader, …)) で { model } として集約できる。
function VRMLoader(unit, { url }) {
  xnew.promise('model', (resolve) => {
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));
    loader.load(url, (gltf) => {
      const vrm = gltf.userData.vrm;
      vrm.scene.scale.set(0.8, 0.8, 0.8);
      vrm.scene.position.y = -0.8;
      vrm.scene.position.z = -0.4;
      vrm.scene.rotation.x = +Math.PI * 20 / 180;
      resolve(vrm);
    });
  });
}

function BakedCharacters(unit) {
  const camera = new THREE.OrthographicCamera(-1, +1, +1, -1, 0.1, 10);
  xthree.initialize({ camera, canvas: new OffscreenCanvas(BAKE_FRAME_SIZE, BAKE_FRAME_SIZE) });
  xthree.camera.position.set(0, -0.1, 2.5);

  const composer = new EffectComposer(xthree.renderer);
  composer.addPass(new RenderPass(xthree.scene, xthree.camera));
  const ssaoPass = new SSAOPass(xthree.scene, xthree.camera, xthree.canvas.width, xthree.canvas.height);
  // OrthographicCamera 用: シェーダーの PERSPECTIVE_CAMERA=1 を両マテリアルで 0 に上書き
  for (const material of [ssaoPass.ssaoMaterial, ssaoPass.depthRenderMaterial]) {
    material.defines['PERSPECTIVE_CAMERA'] = 0;
    material.needsUpdate = true;
  }
  ssaoPass.kernelRadius = 0.15;   // サンプリング半径
  ssaoPass.minDistance = 0.001;   // 最小距離（linearized depth 0〜1 スケール）
  ssaoPass.maxDistance = 0.02;    // 最大距離
  composer.addPass(ssaoPass);
  composer.addPass(new OutputPass());

  xthree.add(new THREE.AmbientLight(0xFFFFFF, 1.2));
  const dirLight = xthree.add(new THREE.DirectionalLight(0xFFFFFF, 1.7));
  dirLight.position.set(2, 5, 10);

  // 焼くジョブ: 敵4体（spin）→ 自機（固定）。
  const jobs = [
    ...ENEMIES.map((enemy) => ({ url: asset(enemy.file), spin: true })),
    { url: asset(PLAYER_FILE), spin: false },
  ];

  // 全フレームを1枚のアトラス canvas に敷き詰め「キャラ1体 = GPU テクスチャ1枚」にする（source 共有でバッチ描画も効く）。
  const cols = Math.ceil(Math.sqrt(BAKE_FRAMES));
  const rows = Math.ceil(BAKE_FRAMES / cols);

  // 各 VRM ローダーを子 unit として登録（集約結果 { model } が下の then の vrms に登録順で入る）。
  jobs.forEach((job) => xnew.promise('vrms[]', xnew(VRMLoader, { url: job.url })));

  // 全 VRM ロード後に unit scope 内でベイク（xthree.add/remove が効く）。全キャラ焼き終えたら最終 dispose。
  // Contents は xnew.promise(child) 経由でこの焼き上がりまで待つ（焼き上がりの Promise を return して直列化）。
  xnew.promise(unit).then(({ vrms }) => {
    // VRM をマウントする回転リグ（scene 直下に1つだけ）。各キャラを付け外ししながら焼く。
    let atlasCanvas;
    let atlasContext; // アトラス canvas の 2D コンテキスト（各フレームをこの上に貼り込む）
    let source; // アトラス canvas を共有する唯一の GPU テクスチャ source（各フレームはこの sub-texture）

    // 全キャラ × 各 BAKE_FRAMES をフラットに畳む。キャラ境界は index 演算で判定。
    const total = jobs.length * BAKE_FRAMES;
    const bakeFrame = (index) => {
      const j = Math.floor(index / BAKE_FRAMES); // どのキャラ
      const f = index % BAKE_FRAMES;             // そのキャラの何フレーム目
      const job = jobs[j];
      const vrm = vrms[j].model;

      if (f === 0) {
        // startJob 相当: VRM をマウントし、貼り込み先アトラスと共有 source を用意。
        xthree.add(vrm.scene);
        atlasCanvas = document.createElement('canvas');
        [atlasCanvas.width, atlasCanvas.height] = [cols * BAKE_FRAME_SIZE, rows * BAKE_FRAME_SIZE];
        atlasContext = atlasCanvas.getContext('2d');
        source = PIXI.Texture.from(atlasCanvas).source;
        job.textures = [];
      }

      // 1フレームぶんのポーズを当てる。t は 1 周期 [0, 3π) を BAKE_FRAMES 等分。回転・ボーンの
      // sin(t×偶数) は t=3π で開始位相へ戻りシームレスにループする（係数を変えるなら t=3π で元に戻るか要確認）。
      // job.spin=true: 回る敵 / false: 後ろ向き固定の自機。
      const t = f * (Math.PI / BAKE_FRAMES * 3);
      if (job.spin) {
        xthree.scene.rotation.y = t * 4 / 3;
        xthree.scene.rotation.z = t * 2 / 3;
      } else {
        xthree.scene.rotation.x = 60 * Math.PI / 180; // 後ろ向きから少し見下ろす角度に
        xthree.scene.rotation.y = Math.PI; // 後ろ向き固定（自機）
        xthree.scene.rotation.z = 0;
      }
      const g = (name) => vrm.humanoid.getNormalizedBoneNode(name);
      g('neck').rotation.x          = Math.sin(t * 8)  *  0.02;
      g('chest').rotation.x         = Math.sin(t * 12) *  0.05;
      g('hips').position.z          = Math.sin(t * 12) *  0.05;
      g('leftUpperArm').rotation.z  = Math.sin(t * 12) *  0.7;
      g('leftUpperArm').rotation.x  = Math.sin(t * 6)  *  0.8;
      g('rightUpperArm').rotation.z = Math.sin(t * 12) * -0.7;
      g('rightUpperArm').rotation.x = Math.sin(t * 6)  *  0.8;
      g('leftUpperLeg').rotation.z  = Math.sin(t * 8)  *  0.2;
      g('leftUpperLeg').rotation.x  = Math.sin(t * 12) *  0.7;
      g('rightUpperLeg').rotation.z = Math.sin(t * 8)  * -0.2;
      g('rightUpperLeg').rotation.x = Math.sin(t * 12) * -0.7;
      vrm.update(t);
      composer.render();
      // フレーム f のアトラス内左上座標。OffscreenCanvas は CanvasImageSource なので render 直後の canvas を直接貼り込む（中間 ImageBitmap 不要）
      const [x, y] = [(f % cols) * BAKE_FRAME_SIZE, Math.floor(f / cols) * BAKE_FRAME_SIZE];
      atlasContext.drawImage(xthree.canvas, x, y);
      // 貼り込みと同じ座標で source 共有の sub-texture を切り出す（ピクセルコピーではなく矩形ビュー）
      job.textures.push(new PIXI.Texture({ source, frame: new PIXI.Rectangle(x, y, BAKE_FRAME_SIZE, BAKE_FRAME_SIZE) }));

      if (f === BAKE_FRAMES - 1) {
        // endJob 相当: アトラスを GPU へ確定アップロードし、wrapper から外して GPU を解放。
        source.update();
        xthree.remove(vrm.scene);
      }
    };
    // 時間予算（8ms）で毎フレーム分散し GPU スパイクを抑える。完了時 resolve するネイティブ
    // Promise を return し、xnew.promise(unit) チェーンを焼き上がりまで直列化する。
    return new Promise((resolve) => {
      let index = 0;
      const handler = () => {
        const t0 = Date.now();
        do { bakeFrame(index++); } while (index < total && Date.now() - t0 < 8);
        if (index >= total) { unit.off('update', handler); resolve(); }
      };
      unit.on('update', handler);
    }).then(() => {
      // 後段パスを解放し xthree.finalize で Root（renderer + WebGL コンテキスト）を畳む。
      composer.dispose();
      ssaoPass.dispose();
      xthree.finalize();
    });
  });

  return {
    get texturesList() { return jobs.slice(0, ENEMIES.length).map((job) => job.textures); },
    get playerTextures() { return jobs[jobs.length - 1].textures; },
  };
}

// ---- Scenes ----

// skipStory: リザルトから戻ってきたときは true。ストーリーを飛ばして直接ゲームへ。
function TitleScene(unit, { skipStory = false } = {}) {
  xnew.extend(xbasics.Scene);

  xnew(Background);
  xnew(TitleCharacters); // 中央のうさぎ + 周囲で蠢く敵4キャラ（背景の上・HTMLテキストの下）

  xnew(TitleText, { text: 'とーほくショット', color: 'text-blue-600' });
  xnew(TouchMessage, { color: 'text-blue-600' });
  xnew(VolumeControl, { className: 'text-stone-300 z-10' });

  unit.on('pointerdown window.keydown.space', ({ event }) => {
    event.preventDefault();
    unit.change(skipStory ? GameScene : StoryScene);
  });
}

// タイトル画面の主役表示：中央に中国うさぎ（usagi03、下1/3は画面外）、その周囲で敵4キャラが蠢く。
function TitleCharacters(unit) {
  xpixi.nest(new PIXI.Container());

  // 周囲の敵4キャラ（id 0..3）。うさぎより先に追加して背面に置く。
  const spots = [
    { id: 1, x: 300, y: 360, scale: 0.85 }, // 左上
    { id: 2, x: 500, y: 380, scale: 0.90 }, // 右上
    { id: 0, x: 250, y: 490, scale: 1.00 }, // 左
    { id: 3, x: 555, y: 475, scale: 1.05 }, // 右
  ];
  for (const spot of spots) xnew(DriftingFactor, spot);

  // 中央の中国うさぎ（下1/3が画面下に隠れるよう中心を下げる）
  xpixi.load(asset('usagi03.png')).then((texture) => {
    const usagi = xpixi.add(new PIXI.Sprite(texture));
    usagi.anchor.set(0.5);
    const H = 456;                               // 表示する高さ(px)（元の 380 の約1.2倍）
    usagi.scale.set(H / texture.height);
    usagi.position.set(400, 600 - H / 6);        // 下1/3 (=H/3) が y=600 より下に出る
  });
}

// 漂うベイクスプライト1体（ポップイン → 蠢く拡縮 + 漂い + 回転）。
// タイトル（定位置）/ 寸劇（ランダム湧き）が位置・スケールだけ変えて共有（揺れ方は固定、個体差は phx/phy の位相で出る）。テクスチャは共有なので温存される。
function DriftingFactor(unit, { id, x, y, scale }) {
  // 漂い/蠢きの細かいパラメータは両呼び出し元で共通の固定値。
  const driftX = 22, driftY = 18, driftSpeedX = 0.02, driftSpeedY = 0.025;
  const rotSpeed = 0.04, popSpeed = 0.05, squirmAmp = 0.1, squirmSpeed = 0.09;

  xpixi.nest(new PIXI.Container());
  const sprite = xnew(BakedSprite, { id, scale: 0, frame: 'random' }).sprite;
  sprite.position.set(x, y);

  const phx = randAngle(), phy = randAngle();
  let pop = 0;
  unit.on('update', ({ count: t }) => {
    pop = Math.min(1, pop + popSpeed); // ポップイン
    sprite.scale.set(scale * pop * squirmFactor(t, phx, squirmAmp, squirmSpeed));
    sprite.x = x + Math.sin(t * driftSpeedX + phx) * driftX;
    sprite.y = y + Math.sin(t * driftSpeedY + phy) * driftY;
    sprite.rotation = Math.sin(t * rotSpeed + phy) * 0.12;
  });
}

// ゲーム前の導入寸劇（2ページ）。タップで送り、最後のページからゲームへ。
//  1: 中国うさぎがずんだアローに被弾（コミカル）
//  2: 体内で増殖するずんだ因子（4キャラ）が蠢く
function StoryScene(unit) {
  xnew.extend(xbasics.Scene);

  xnew(Background);   // 体内背景を流用（タイトル/ゲームと連続感）
  xnew(CameraShake);  // 被弾時のシェイク演出用
  xnew(VolumeControl, { className: 'text-stone-300 z-10' });
  xnew(StoryTheater); // 下部の黒帯（セリフはこの上に表示）。pages より先に作り、テキストの背面に置く

  const pages = [StoryPageHit, StoryPageSwarm];
  let index = 0;
  let page = xnew(pages[0]);

  let busy = false;

  unit.on('pointerdown window.keydown.space', ({ event }) => {
    event.preventDefault();
    if (busy) return;
    busy = true;
    const next = index + 1;
    if (next >= pages.length) {
      unit.change(GameScene);
      return;
    }
    page.finalize();
    index = next;
    page = xnew(pages[index]);
    xnew.timeout(() => { busy = false; }, 300); // 連打での飛ばし過ぎを防ぐ
  });
}

// 下部の黒帯（シアターモード風）。セリフはこの帯の上に載せて読ませる。高さ 26cqw（≒208px）。
function StoryTheater(unit) {
  xnew.nest('<div class="absolute inset-0 pointer-events-none">');
  // 帯の上にせり出すフェザー（境界をやわらかく、キャラの足元と馴染ませる）
  xnew('<div class="absolute left-0 right-0 bottom-[26cqw] h-[7cqw]" style="background: linear-gradient(to top, rgba(4,3,7,0.9), rgba(4,3,7,0));">');
  // 黒帯本体
  xnew('<div class="absolute left-0 right-0 bottom-0 h-[26cqw]" style="background: rgba(4,3,7,0.9);">');
  // CRT 走査線（サイバーな質感）
  xnew('<div class="absolute left-0 right-0 bottom-0 h-[26cqw]" style="background: repeating-linear-gradient(0deg, transparent 0 0.4cqw, rgba(0,0,0,0.22) 0.4cqw 0.8cqw);">');
  // 上端のアクセントライン（うっすら発光）
  xnew('<div class="absolute left-0 right-0 bottom-[26cqw] h-[0.28cqw]" style="background: linear-gradient(90deg, transparent, rgba(255,143,163,0.75) 18%, rgba(255,143,163,0.75) 82%, transparent); box-shadow: 0 0 1.4cqw rgba(255,143,163,0.55);">');
}

// ストーリーのセリフをサイバーな字幕フレームで黒帯の上に重ねる。build=本文(SVGText 群) / accent=アクセント色 /
// tag=見出しラベル / bottomCqw=下端位置。ヘッダー(点滅● + ▶TAG) と四隅ブラケット＋発光を付与。
// extend して使う。本文は呼び出し元が extend 後に続けて追加する（最後の nest = 本文 wrap が
// current 要素になるため）。例:
//   xnew((unit) => { xnew.extend(StoryDialog, { ... }); xnew('<div>', ...); });
function StoryDialog(_unit, { accent, tag, bottomCqw }) {
  xnew.nest(`<div class="absolute left-0 right-0 flex flex-col items-center pointer-events-none" style="bottom:${bottomCqw}cqw; font-family: monospace;">`);

  // ヘッダー: [線] ● ▶ TAG [線]
  xnew('<div class="flex items-center mb-[1cqw] font-bold tracking-[0.3em]" style="font-size:1.8cqw;">', () => {
    const lineL = xnew('<div class="mr-[1cqw]" style="width:6cqw; height:0.18cqw;">');
    lineL.element.style.background = `linear-gradient(90deg, transparent, ${accent})`;
    const blink = xnew('<div class="mr-[0.8cqw]">', '●');
    blink.on('update', ({ count: t }) => {
      blink.element.style.opacity = Math.floor(t / 16) % 2 ? '1' : '0.2';
    });
    const lbl = xnew('<div class="mr-[1cqw]">', `▶ ${tag}`);
    const lineR = xnew('<div style="width:6cqw; height:0.18cqw;">');
    lineR.element.style.background = `linear-gradient(90deg, ${accent}, transparent)`;
    for (const e of [blink, lbl]) e.element.style.color = accent;
  });
  cornerBrackets({ offset: 0, size: 2.2, borderW: 0.25, opacity: 0.85, color: accent });

  // 本文（四隅ブラケットで囲む。drop-shadow でうっすら発光）。中身は extend 側が続けて追加する。
  const wrap = xnew.nest('<div class="relative px-[4cqw] py-[0.6cqw] text-center font-bold leading-tight" style="color:#ffffff;">');
  wrap.style.filter = `drop-shadow(0 0 0.7cqw ${accent}88)`;
}

// ページ1: 中国うさぎがずんだアローに被弾する寸劇
function StoryPageHit(unit) {
  const CX = 400, CY = 215;          // 中国うさぎの中心（黒帯の上・画面中央寄りに配置）
  const impactX = CX, impactY = CY - 30; // 矢の着弾点（体の中央やや上）
  xpixi.nest(new PIXI.Container());

  // 着弾フラッシュ（シェイクで端が抜けないよう広め）。usagi/arrow より後に追加して最前面に置く。
  const flashG = xpixi.add(new PIXI.Graphics().rect(-40, -40, 880, 680).fill(0xFFFFFF));
  flashG.alpha = 0;

  let usagi = null;
  xpixi.load(asset('usagi03.png')).then((loaded) => {
    usagi = xpixi.add(new PIXI.Sprite(loaded));
    usagi.anchor.set(0.5);
    usagi.scale.set(340 / usagi.texture.height); // やや大きめに
    usagi.position.set(CX, CY);
  });

  let arrow = null;
  xpixi.load(asset('zunda_arrow.png')).then((loaded) => {
    arrow = xpixi.add(new PIXI.Sprite(loaded));
    arrow.anchor.set(0.86, 0.5); // 先端（ずんだ玉）側を基準に
    arrow.scale.set(200 / arrow.texture.width);
    arrow.position.set(-220, impactY);
  });

  // セリフ（黒帯の中・サイバー字幕）。被弾の驚きをコミカルに。補足は着弾後にフェードイン。
  let sub;
  xnew(() => {
    xnew.extend(StoryDialog, { accent: '#FF8FA3', tag: 'ALERT', bottomCqw: 4.5 });

    xnew('<div style="color:#FF8FA3;">', () => { xnew(xbasics.SVGText, { text: 'ずんだアローに当たってしまった！', fontSize: '5.2cqw', stroke: '#0a1830', strokeWidth: '0.25cqw', className: 'inline-block' }); });
    sub = xnew('<div class="mt-[0.6cqw]" style="color:#FCEFA0; opacity:0;">', () => {
      xnew(xbasics.SVGText, { text: '（ずんだアローに当たると、ずんだ餅にされてしまう…）', fontSize: '2.5cqw', stroke: '#0a1830', strokeWidth: '0.2cqw', className: 'inline-block' });
    });
  });

  const FLY = 40; // 飛来フレーム数（約0.7秒）
  let impacted = false, hitT = 0;
  unit.on('update', ({ count }) => {
    if (arrow === null || usagi === null) return;
    if (!impacted) {
      const p = Math.min(1, count / FLY);
      const e = p * p; // 加速して突き刺さる
      arrow.x = -220 + (impactX + 220) * e;
      if (p >= 1) {
        impacted = true;
        xnew.emit('+shake', { amount: 0.7 });
        xnew(ExpandingBurst, { x: impactX + 28, y: impactY, power: 2.4 });
        flashG.alpha = 0.85;
        xnew.transition(({ value }) => { sub.element.style.opacity = `${value}`; }, 500, 'ease');
      }
    } else {
      hitT++;
      flashG.alpha = Math.max(0, flashG.alpha - 0.08);
      const damp = Math.exp(-hitT * 0.05);     // 揺れの減衰
      const wob = Math.sin(hitT * 0.8) * damp;
      usagi.rotation = wob * 0.16;              // ぷるぷる
      usagi.x = CX + wob * 9;
      arrow.x = impactX + wob * 9;              // 刺さったまま一緒に揺れる
      arrow.rotation = wob * 0.08;
    }
  });
}

// ページ2: 体内で増殖するずんだ因子（4キャラ）が蠢く様子
function StoryPageSwarm(unit) {
  xpixi.nest(new PIXI.Container());

  // 少しずつ湧いて増えていく（増殖感）。黒帯より上（テキスト帯に被らない領域）に位置・スケールをランダムに散らす。
  xnew.interval(() => {
    xnew(DriftingFactor, {
      id: randInt(xnew.context(BakedCharacters).texturesList.length),
      x: randRange(90, 710),
      y: randRange(90, 360),
      scale: randRange(0.5, 1.0),
    });
  }, 200, 64);

  xnew(() => {
    xnew.extend(StoryDialog, { accent: '#9BE53C', tag: 'MISSION', bottomCqw: 5 });

    xnew('<div class="mb-[0.6cqw]">', () => { xnew(xbasics.SVGText, { text: '体内の免疫キャラを操作し、', fontSize: '4cqw', stroke: '#0a1830', strokeWidth: '0.22cqw', className: 'inline-block' }); });
    xnew('<div style="color:#9BE53C;">', () => { xnew(xbasics.SVGText, { text: 'ずんだ因子の増殖を食い止めろ！', fontSize: '4.4cqw', stroke: '#0a1830', strokeWidth: '0.25cqw', className: 'inline-block' }); });
  });
}

function GameScene(unit) {
  xnew.extend(xbasics.Scene);

  xnew(Background);
  xnew(CameraShake);
  xnew(SoundFX);
  xnew(SidePanel);
  xnew(Controller);
  const scoreManager = xnew(ScoreManager);
  const waveManager = xnew(WaveManager);
  xnew(ScoreGauge);
  xnew(ShotEnergy);
  xnew(Player);
  xnew(VolumeControl, { className: 'text-stone-300 z-10' });

  const bgm = xnew(() => {
    xnew(xbasics.AudioTrack, { url: asset('maou_bgm_cyber31.mp3') }).play({ fade: 1000, loop: true });
  });

  unit.once('+gameover', () => {
    bgm.finalize(); // ゲームオーバーで BGM 停止
    const score = scoreManager.score;
    const wave = waveManager.wave;
    const kills = [...scoreManager.kills];
    // 最終 wave(4) のゲージを 100% 到達済みなら「クリア」扱い（wave4 は次へ進まないので waveScore で判定）
    const cleared = wave >= WAVE_GOALS.length && scoreManager.waveScore >= WAVE_GOALS[WAVE_GOALS.length - 1];
    const gameover = xnew(GameOverText, { className: 'left-0 right-[25cqw]' });

    // pixi extract では DOM の UI が写らないため、html2canvas で画面ごと撮る。
    xpixi.renderer.render(xpixi.scene); // preserveDrawingBuffer なしでも同一タスク内の描画直後なら canvas が写る
    const image = html2canvas(document.querySelector('#main'), {
      scale: 2, logging: false, useCORS: true,
      ignoreElements: (element) => element === gameover.element,
    }).then((canvas) => canvas.toDataURL('image/png'));
    xnew.timeout(() => unit.change(ResultScene, { image, score, wave, kills, cleared }), 2000);
  });
}

function ResultScene(unit, { image, score, wave, kills, cleared }) {
  xnew.extend(xbasics.Scene);

  xnew(xbasics.AudioTrack, { url: asset('st005.mp3') }).play({ fade: 1, loop: true });

  // popup
  xnew.nest(`<div class="absolute inset-0 size-full">`);
  xnew.transition(({ value }) => {
    Object.assign(unit.element.style, { opacity: value, transform: `scale(${0.8 + value * 0.2})` });
  }, 500, 'ease');

  xnew(ResultBackground, { gradient: 'from-slate-900 to-blue-950', textColor: 'text-blue-800' });

  // 画面割り: 上下 80:20、上部分をさらに左右 50:50
  xnew((unit) => {
    xnew.extend(xbasics.Split, { direction: 'column' });
    unit.pane({ size: 1 - RESULT_FOOTER_RATIO, direction: 'row' }, (upper) => {
      upper.pane({ size: 50 }, () => {
        xnew(xbasics.Image, { src: image, className: 'absolute inset-x-0 bottom-[2cqw] mx-auto w-[46cqw] aspect-4/3 rounded-[1cqw] object-cover', style: 'box-shadow: 0 10px 30px rgba(0,0,0,0.3);' });
      });
      upper.pane({ size: 50 }, () => {
        xnew(ResultDetail, { score, wave, kills, cleared });
      });
    });
    unit.pane({ size: RESULT_FOOTER_RATIO }, ResultFooter);
  });

  unit.on('window.keydown.space', ({ event }) => { event.preventDefault(); unit.change(TitleScene, { skipStory: true }); });
}

// ---- Wave system ----

// wave1..4 の「その wave 内」で稼ぐ目標スコア（index = wave-1）。各 wave は 0 から貯め、
// waveScore がこの値に達すると次 wave へ。wave4 はゲージは満タンになるが次へは進まない（エンドレス）。
const WAVE_GOALS = [1024, 2048, 3072, 4096];

// 警告画面の表示開始から湧き再開までの時間。WaveTransition の演出
// （フェードイン450 + 表示2100 + フェードアウト450 ≒ 2550ms）を覆う長さにする。
const WAVE_WARNING_MS = 2800;

function WaveManager(unit) {
  let wave = 0;
  let transitioning = false;

  function startWave(n) {
    wave = n;
    xnew.emit('+wave', { wave });
  }

  // 警告画面を出し、表示が終わるまで湧きを transitioning で止める（onDone は湧き再開の直前に呼ぶ）
  function showWarning(next, onDone) {
    transitioning = true;
    xnew.context(xbasics.Scene).add(WaveTransition, { wave: next });
    xnew.timeout(() => { onDone?.(); transitioning = false; }, WAVE_WARNING_MS);
  }

  function nextWave() {
    const next = wave + 1;
    // 画面内の敵を一旦フェードアウト（得点は入らない）
    for (const enemy of xnew.find(Enemy)) enemy.fadeOut();
    showWarning(next, () => startWave(next));
  }

  // wave1 も警告画面を出してから開始（初回も同じ導入演出）。
  // wave は即 1 にする（0 のままだと ScoreGauge のしきい値計算が NaN になり恒久的に壊れる）。
  startWave(1);
  showWarning(1);

  let spawnTick = 0;
  const spawn = xnew.interval(() => {
    spawnTick++;
    if (transitioning) return;
    // その wave の目標スコアに達したら次の wave へ（最終 wave は到達してもエンドレスで移行しない）
    if (wave < WAVE_GOALS.length && xnew.context(ScoreManager).waveScore >= WAVE_GOALS[wave - 1]) {
      nextWave();
      return;
    }

    const scene = xnew.context(xbasics.Scene);
    // 自動出現はその wave のキャラ1種のみ。下位キャラは被弾時の分裂で登場。
    const id = enemyIdForWave(wave);
    // 高い wave ほど分裂で増えるのでスポーン間隔を空ける
    if (spawnTick % (id + 1) === 0) scene.add(Enemy, { id });
  }, 200);

  unit.on('+gameover', () => spawn.clear());

  return { get wave() { return wave; } };
}

// wave 切替時のサイバーな警告画面（プレイ領域）。HUDフレーム + グリッチ WAVE 表示 + 流れる hex + 脅威解析バー。
function WaveTransition(unit, { wave }) {
  const color = waveCss(wave);
  const code = ENEMIES[enemyIdForWave(wave)].code;
  xnew.nest('<div class="absolute left-0 right-[25cqw] top-0 bottom-0 overflow-hidden pointer-events-none" style="font-family: monospace;">');
  unit.element.style.color = color; // 文字はすべて wave 色を継承

  // 暗幕 + 色フラッシュ + 走査線オーバーレイ
  const flash = xnew('<div class="absolute inset-0">');
  flash.element.style.background = color;
  xnew('<div class="absolute inset-0" style="background: rgba(2,4,8,0.4);">');
  xnew('<div class="absolute inset-0" style="background: repeating-linear-gradient(0deg, transparent 0 0.35cqw, rgba(0,0,0,0.28) 0.35cqw 0.7cqw);">');

  // 斜めの警告ストライプ（上下）
  const stripe = `repeating-linear-gradient(45deg, ${color} 0, ${color} 1cqw, transparent 1cqw, transparent 2.2cqw)`;
  for (const edge of ['top-0', 'bottom-0']) {
    const s = xnew(`<div class="absolute ${edge} left-0 right-0 h-[2.4cqw]" style="opacity:0.45;">`);
    s.element.style.background = stripe;
  }

  // HUD コーナーブラケット（四隅）。色は親の currentColor（wave 色）を継承。
  cornerBrackets({ offset: 2, size: 5, borderW: 0.4, opacity: 0.8 });

  // 縦に流れる走査ライン
  const scan = xnew('<div class="absolute left-0 right-0 h-[0.35cqw]" style="top:0;">');
  scan.element.style.background = color;
  scan.element.style.boxShadow = `0 0 1.6cqw ${color}`;

  // 上部の謎文字（左：システムアラート / 右：流れる hex）
  xnew('<div class="absolute left-[3.5cqw] top-[5.5cqw] text-[1.9cqw] tracking-[0.3em] font-bold">', '▚ SYSTEM ALERT ▚');
  const hexTop = xnew('<div class="absolute right-[3.5cqw] top-[5.8cqw] text-[1.5cqw] tracking-[0.2em]" style="opacity:0.7;">', '');

  // 中央：WARNING（点滅）+ WAVE N（グリッチ）+ 脅威情報
  let warn, label;
  xnew('<div class="absolute inset-0 flex flex-col items-center justify-center text-center">', () => {
    warn = xnew('<div class="text-[5.5cqw] font-bold tracking-[0.4em]">', '⚠ WARNING ⚠');
    label = xnew('<div class="text-[13cqw] font-bold leading-none">', `WAVE ${wave}`);
    xnew('<div class="text-[2.2cqw] tracking-[0.25em] mt-[1.2cqw]" style="opacity:0.9;">', `THREAT Lv.${wave}　ENTITY ${code}`);
  });

  // 下部：脅威解析バー + 流れる hex
  let pctEl, bar, streamEl;
  xnew('<div class="absolute left-[3.5cqw] right-[3.5cqw] bottom-[5cqw]">', () => {
    xnew('<div class="flex justify-between text-[1.5cqw] tracking-[0.2em] mb-[0.5cqw]" style="opacity:0.9;">', () => {
      xnew('<div>', '▶ ANALYZING THREAT');
      pctEl = xnew('<div>', '0%');
    });
    xnew('<div class="relative w-full h-[1.5cqw]" style="border:0.15cqw solid; box-shadow:0 0 1cqw currentColor;">', () => {
      bar = xnew('<div class="absolute inset-y-0 left-0" style="width:0%;">');
      bar.element.style.background = color;
    });
    streamEl = xnew('<div class="text-[1.2cqw] mt-[0.6cqw] tracking-[0.15em] whitespace-nowrap overflow-hidden" style="opacity:0.6;">', '');
  });

  const VISIBLE = 126; // フェード前のおおよそのフレーム数（解析バーをこの間にちょうど満たす）
  unit.on('update', ({ count: t }) => {
    flash.element.style.opacity = `${(Math.sin(t * 0.08) * 0.5 + 0.5) * 0.1 + 0.03}`; // ゆったり明滅
    warn.element.style.opacity = `${Math.floor(t / 18) % 2 ? 1 : 0.25}`;

    // WAVE N グリッチ：たまに横ズレ + 色収差シャドウ
    const jump = Math.random() < 0.12 ? (Math.random() * 2 - 1) * 0.7 : 0;
    label.element.style.transform = `translateX(${jump}cqw)`;
    label.element.style.textShadow = `0 0 2cqw ${color}, ${0.25 + jump}cqw 0 rgba(255,40,90,0.55), ${-0.25}cqw 0 rgba(40,200,255,0.55)`;

    // 縦走査ライン（上→下を繰り返す）
    scan.element.style.top = `${(t * 1.1) % 100}%`;

    // 流れる謎文字
    if (t % 4 === 0) {
      hexTop.element.textContent = Array.from({ length: 6 }, () => randHex(2)).join(' ');
    }
    if (t % 2 === 0) {
      streamEl.element.textContent = '> ' + randStream(40);
    }

    // 脅威解析バー（0→100% を VISIBLE フレームで満たす）
    const p = Math.min(1, t / VISIBLE);
    bar.element.style.width = `${p * 100}%`;
    pctEl.element.textContent = `${Math.round(p * 100)}%`;
  });

  xnew.transition(({ value }) => { unit.element.style.opacity = value; }, 450);
  xnew.timeout(() => {
    xnew.transition(({ value }) => { unit.element.style.opacity = 1 - value; }, 450).timeout(() => unit.finalize());
  }, 2100);
}

// 右パネル上部の "Wave N" 表示（wave のメインカラーに追従）
function WaveLabel(unit, { wave = 1 } = {}) {
  xnew.nest('<div class="absolute top-[1.5cqw] right-0 w-[25cqw] text-center font-bold text-lime-400">');
  const text = xnew(xbasics.SVGText, { text: 'Wave 1', fontSize: '6cqw', stroke: '#102008', strokeWidth: '0.2cqw', className: 'inline-block' });
  function update({ wave }) {
    text.element.textContent = `Wave ${wave}`;
    unit.element.style.color = waveCss(wave); // SVGText の fill=currentColor が追従
  }
  update({ wave });
  unit.on('+wave', update);
}

// セグメント風メーターの箱（枠 + fill + セグメント隙間 + 走査）。走査(scan)は fill 割合に追従して
// 自前で走らせる（ScoreGauge / ShotEnergy で共有）。fill 幅は setFill(0..1) で更新し、色や opacity は
// frame / fill 経由で触る。
// segment=[隙間開始, 隙間終了]cqw。scanOnTop=true で走査をセグメントの上（最前面）に。extra() で箱末尾に追加要素（目盛り等）。
// scanSpeed=走査の往復速度 / scanMargin=fill 端からの折り返し余白(%)。
// 使い方: const bar = xnew(CyberBar, { ... }); bar.setFill(0.6); bar.fill / bar.frame
function CyberBar(unit, { boxClass, boxStyle, fillWidth, fillStyle = '', segment, scanW, scanAlpha, scanOnTop = true, scanSpeed = 0.05, scanMargin = 0, extra }) {
  let frame, fill, scan;
  const addSegment = () => xnew(`<div class="absolute inset-0" style="background: repeating-linear-gradient(90deg, transparent 0 ${segment[0]}cqw, rgba(0,0,0,0.6) ${segment[0]}cqw ${segment[1]}cqw);">`);
  const addScan = () => { scan = xnew(`<div class="absolute inset-y-0 w-[${scanW}cqw]" style="left:0; background: linear-gradient(90deg, transparent, rgba(255,255,255,${scanAlpha}), transparent);">`); };
  frame = xnew(`<div class="relative w-full ${boxClass}" style="${boxStyle}">`, () => {
    fill = xnew(`<div class="absolute inset-y-0 left-0" style="width:${fillWidth};${fillStyle}">`);
    if (scanOnTop) {
      addSegment();
      addScan();
    } else {
      addScan();
      addSegment();
    }
    if (extra) {
      extra();
    }
  });

  // fill 割合（0..1）を保持し、毎フレーム fill 充填内を走査ラインが往復する。
  let fraction = parseFloat(fillWidth) / 100 || 0;
  unit.on('update', ({ count: t }) => {
    scan.element.style.left = `${(Math.sin(t * scanSpeed) * 0.5 + 0.5) * Math.max(0, fraction * 100 - scanMargin)}%`;
  });

  return {
    get frame() { return frame; },
    get fill() { return fill; },
    setFill(f) { fraction = f; fill.element.style.width = `${f * 100}%`; },
  };
}

// 次の wave までの進捗を示す「解析メーター」（画面左上）。色は wave のメインカラー。
function ScoreGauge(unit, { wave = 1 } = {}) {
  xnew.nest('<div class="absolute top-[2cqw] left-[2cqw] right-[44cqw]" style="font-family: monospace;">');

  // 見出し行（ラベル + パーセント）
  let labelEl, pctEl;
  xnew('<div class="flex justify-between items-end mb-[0.4cqw] text-[1.5cqw] tracking-[0.2em]">', () => {
    labelEl = xnew('<div>', 'ANALYSIS');
    pctEl = xnew('<div>', '0%');
  });
  // メーター本体（セグメント風）
  const bar = xnew(CyberBar, {
    boxClass: 'h-[2.4cqw] bg-black/50',
    boxStyle: 'border: 0.2cqw solid; overflow: hidden;',
    fillWidth: '0%',
    segment: [1.4, 1.8],
    scanW: 3, scanAlpha: 0.5, scanSpeed: 0.04, scanMargin: 3,
  });

  function update({ wave }) {
    const c = waveCss(wave);
    bar.fill.element.style.background = c;
    bar.frame.element.style.borderColor = c;
    labelEl.element.style.color = c;
    pctEl.element.style.color = c;
  }
  update({ wave });
  unit.on('+wave', update);

  let shown = 0;
  unit.on('update', () => {
    const wave = xnew.context(WaveManager).wave;
    const waveScore = xnew.context(ScoreManager).waveScore;

    // その wave の目標スコアに対する達成率（0..1）。wave4 以降も同様に貯まり、満タンで頭打ち。
    const goal = WAVE_GOALS[Math.min(Math.max(wave, 1), WAVE_GOALS.length) - 1];
    const target = wave < 1 ? 0 : Math.max(0, Math.min(1, waveScore / goal));

    if (!Number.isFinite(shown)) shown = 0; // NaN に陥っても自己回復する保険
    shown += (target - shown) * 0.15; // イージング（wave 切替時に滑らかにリセット）
    bar.setFill(shown);
    pctEl.element.textContent = `${Math.round(shown * 100)}%`;
  });
}

// ---- Game Components ----

// 右端のイラストパネル。上=Wave / 中=駆逐対象(ターゲット表示) / 下=中国うさぎ（敵数で表情切替）
function SidePanel(unit) {
  xnew(PanelBackdrop);     // pixi: 半透明パネル背景 + 区切り線
  xnew(WaveEnemyDisplay);  // pixi: その wave で登場する敵キャラ
  xnew(TargetReticle);     // pixi: 敵キャラを囲うターゲットレティクル
  xnew(WaveLabel);         // html: 上部の "Wave N"
  xnew(TargetInfo);        // html: "TARGET" + サイバーなパラメータ
  xnew(UsagiFace);         // html: 下部のうさぎ（敵数で表情クロスフェード）
}

// 半透明（約50%）のパネル背景 + 区切り線（区切り線は wave のメインカラーに追従）
function PanelBackdrop(unit, { wave = 1 } = {}) {
  xpixi.nest(new PIXI.Container());
  xpixi.add(new PIXI.Graphics().rect(PLAY_RIGHT, 0, PANEL_W, 600).fill({ color: 0x05121A, alpha: 0.5 }));

  const divider = xpixi.add(new PIXI.Graphics());
  function update({ wave }) {
    divider.clear();
    divider.moveTo(PLAY_RIGHT, 0).lineTo(PLAY_RIGHT, 600).stroke({ color: waveColor(wave), width: 2, alpha: 0.55 });
  }
  update({ wave });
  unit.on('+wave', update);
}

// その wave で登場する敵キャラを表示（wave1:ずんだもん 2:きりたん 3:ずん子 4:イタコ）
const TARGET_Y = 148; // ターゲット表示(敵キャラ+レティクル)の中心 y

function WaveEnemyDisplay(unit) {
  xpixi.nest(new PIXI.Container({ position: { x: PLAY_RIGHT + PANEL_W / 2, y: TARGET_Y } }));
  let current = null; // 現在表示中の BakedSprite unit（クロスフェードで差し替える）

  unit.on('+wave', ({ wave }) => {
    const id = enemyIdForWave(wave); // wave4 以降はイタコ固定
    const next = xnew(BakedSprite, { id, scale: 0.82 });
    next.sprite.alpha = 0;

    const old = current;
    current = next;
    xnew.transition(({ value }) => {
      next.sprite.alpha = value;
      if (old) old.sprite.alpha = 1 - value;
    }, 400).timeout(() => { if (old) old.finalize(); });
  });
}

// 敵キャラを囲うサイバーなターゲットレティクル（色は wave 連動）。
// 多重リング（逆回転）+ レーダー掃引 + 呼吸するロックオンブラケット + 周回する解析ブリップ。
function TargetReticle(unit, { wave = 1 } = {}) {
  xpixi.nest(new PIXI.Container({ position: { x: PLAY_RIGHT + PANEL_W / 2, y: TARGET_Y } }));
  const R = 46;

  // 独立回転させる層（container の子に直接 rotation を持たせる）
  const outer = xpixi.add(new PIXI.Container());   // 外周リング（CW）
  const mid = xpixi.add(new PIXI.Container());     // 中アーク（CCW）
  const sweepC = xpixi.add(new PIXI.Container());  // レーダー掃引（CW）
  const blips = xpixi.add(new PIXI.Container());   // 周回ブリップ
  const brackets = xpixi.add(new PIXI.Graphics()); // ロックオンブラケット
  const cross = xpixi.add(new PIXI.Graphics());
  
  const outerG = new PIXI.Graphics(); outer.addChild(outerG);
  const midG = new PIXI.Graphics(); mid.addChild(midG);
  const sweepG = new PIXI.Graphics(); sweepC.addChild(sweepG);

  // 周回ブリップ（ランダムな半径/角速度）
  const dots = [];
  for (let i = 0; i < 6; i++) {
    const g = new PIXI.Graphics();
    blips.addChild(g);
    dots.push({ g, radius: randRange(24, 50), ang: randAngle(), spd: randRange(0.01, 0.04) * randSign(), size: randRange(1.1, 2.5) });
  }

  let color = ENEMIES[0].color;

  function draw(c) {
    color = c;

    // 外周リング + 目盛り（15°刻み、45°ごとに長い）
    outerG.clear();
    outerG.circle(0, 0, R).stroke({ color: c, width: 1.5, alpha: 0.5 });
    for (let a = 0; a < 360; a += 15) {
      const rad = a * Math.PI / 180;
      const long = a % 45 === 0;
      outerG.moveTo(Math.cos(rad) * (R - (long ? 7 : 4)), Math.sin(rad) * (R - (long ? 7 : 4)))
            .lineTo(Math.cos(rad) * (R + 2), Math.sin(rad) * (R + 2));
    }
    outerG.stroke({ color: c, width: 1, alpha: 0.45 });

    // 中アーク（4本の90°弧に隙間）+ 内側の細い円
    midG.clear();
    const rM = 36;
    for (let k = 0; k < 4; k++) {
      const a0 = k * Math.PI / 2 + 0.2, a1 = (k + 1) * Math.PI / 2 - 0.2;
      midG.moveTo(Math.cos(a0) * rM, Math.sin(a0) * rM).arc(0, 0, rM, a0, a1); // moveTo で弧同士をつなぐ弦を防ぐ
    }
    midG.stroke({ color: c, width: 2, alpha: 0.8 });
    midG.circle(0, 0, 27).stroke({ color: c, width: 1, alpha: 0.3 });

    // レーダー掃引（先端へ向かって濃くなる扇）
    sweepG.clear();
    const SEG = 16, SPAN = 1.0;
    for (let i = 0; i < SEG; i++) {
      const a0 = -(i / SEG) * SPAN, a1 = -((i + 1) / SEG) * SPAN;
      sweepG.moveTo(0, 0).lineTo(Math.cos(a0) * R, Math.sin(a0) * R).lineTo(Math.cos(a1) * R, Math.sin(a1) * R).lineTo(0, 0)
            .fill({ color: c, alpha: (1 - i / SEG) * 0.16 });
    }
    sweepG.moveTo(0, 0).lineTo(R, 0).stroke({ color: c, width: 1.5, alpha: 0.7 }); // 先端ライン

    // クロスヘア + 中心点
    cross.clear();
    cross.moveTo(-R - 5, 0).lineTo(-R + 11, 0).moveTo(R - 11, 0).lineTo(R + 5, 0)
         .moveTo(0, -R - 5).lineTo(0, -R + 11).moveTo(0, R - 11).lineTo(0, R + 5)
         .stroke({ color: c, width: 1, alpha: 0.45 });
    cross.circle(0, 0, 2).fill({ color: c, alpha: 0.85 });

    // ブリップの点を原点に描いておく（位置は update で動かす）
    for (const d of dots) {
      d.g.clear();
      d.g.circle(0, 0, d.size).fill({ color: c, alpha: 0.85 });
    }
  }

  function update({ wave }) {
    draw(waveColor(wave));
  }
  update({ wave });
  unit.on('+wave', update);

  unit.on('update', ({ count: t }) => {
    outer.rotation += 0.006;
    mid.rotation -= 0.014;
    sweepC.rotation = t * 0.05;

    // ロックオンブラケット：呼吸（拡縮）+ うっすら明滅
    const breathe = 40 * (1 + Math.sin(t * 0.06) * 0.06);
    const len = 13;
    brackets.clear();
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      brackets.moveTo(sx * breathe - sx * len, sy * breathe).lineTo(sx * breathe, sy * breathe).lineTo(sx * breathe, sy * breathe - sy * len);
    }
    brackets.stroke({ color, width: 2, alpha: 0.7 + 0.25 * Math.sin(t * 0.1) });

    // 周回ブリップ
    for (const d of dots) {
      d.ang += d.spd;
      d.g.position.set(Math.cos(d.ang) * d.radius, Math.sin(d.ang) * d.radius);
      d.g.alpha = 0.4 + 0.5 * Math.abs(Math.sin(t * 0.08 + d.ang));
    }
  });
}

// レティクル周辺に「解析中っぽい」謎文字を表示する HUD（色は wave 連動）。
// ヘッダー / 四隅の座標ラベル / 円の左右を流れる hex レール / 下部の解析リードアウト。
function TargetInfo(unit, { wave = 1 } = {}) {
  xnew.nest('<div class="absolute right-0 top-0 bottom-0 w-[25cqw] pointer-events-none" style="font-family: monospace; color:#9BE53C;">');

  // ヘッダー
  xnew('<div class="absolute w-full text-center text-[2cqw] tracking-[0.35em] font-bold" style="top: 8cqw;">', '◤ TARGET ◢');

  // レティクル四隅の微小ラベル（座標・ロック状態っぽい謎文字）
  const cTL = xnew('<div class="absolute text-[1.15cqw]" style="top: 11.5cqw; left: 2cqw; opacity:0.65;">', 'LAT +00.0');
  const cTR = xnew('<div class="absolute text-[1.15cqw] text-right" style="top: 11.5cqw; right: 2cqw; opacity:0.65;">', 'LON +00.0');
  const cBL = xnew('<div class="absolute text-[1.15cqw]" style="top: 23cqw; left: 2cqw; opacity:0.65;">', 'LOCK ▮');
  const cBR = xnew('<div class="absolute text-[1.15cqw] text-right" style="top: 23cqw; right: 2cqw; opacity:0.65;">', '0x0000');

  // 円の左右を縦に流れる hex レール（解析ダンプ）
  const leftRail = [];
  xnew('<div class="absolute flex flex-col gap-[0.25cqw] text-[1.1cqw] leading-none" style="top: 14cqw; left: 1.4cqw; opacity:0.5;">', () => {
    for (let i = 0; i < 6; i++) leftRail.push(xnew('<div>', randHex(2)));
  });
  const rightRail = [];
  xnew('<div class="absolute flex flex-col items-end gap-[0.25cqw] text-[1.1cqw] leading-none" style="top: 14cqw; right: 1.4cqw; opacity:0.5;">', () => {
    for (let i = 0; i < 6; i++) rightRail.push(xnew('<div>', '··'));
  });

  // 下部の解析リードアウト（自機の上に薄い暗幕を敷いて読ませる）
  let idLine, syncBar, syncPct, stream;
  xnew('<div class="absolute left-[1.5cqw] right-[1.5cqw] flex flex-col items-center leading-tight gap-[0.3cqw] py-[0.6cqw] rounded-[0.6cqw]" style="top: 25cqw; background: rgba(2,8,4,0.4);">', () => {
    idLine = xnew('<div class="text-[1.6cqw]">', 'ID ZD-0x01 ▮');
    xnew('<div class="flex items-center gap-[0.5cqw] text-[1.4cqw]">', () => {
      xnew('<div style="opacity:0.7;">', 'SYNC');
      syncBar = xnew('<div>', '▰▰▰▱▱');
      syncPct = xnew('<div>', '60%');
    });
    stream = xnew('<div class="text-[1.2cqw] tracking-[0.1em]" style="opacity:0.7;">', '> 8A F2 1C 04');
  });

  function update({ wave }) {
    const id = enemyIdForWave(wave);
    idLine.element.textContent = `ID ${ENEMIES[id].code} ${'▮'.repeat(id + 1)}`;
    unit.element.style.color = waveCss(wave); // 全テキストが継承
  }
  update({ wave });
  unit.on('+wave', update);

  const rightTokens = ['OK', '!!', 'ACK', '▮▮', '·▮·', 'SYN'];
  unit.on('update', ({ count: t }) => {
    // hex レールを数フレームごとに1行スクロール（流れる解析ダンプ）
    if (t % 5 === 0) {
      for (let i = 0; i < leftRail.length - 1; i++) leftRail[i].element.textContent = leftRail[i + 1].element.textContent;
      leftRail[leftRail.length - 1].element.textContent = randHex(2);
      for (let i = 0; i < rightRail.length - 1; i++) rightRail[i].element.textContent = rightRail[i + 1].element.textContent;
      rightRail[rightRail.length - 1].element.textContent = Math.random() < 0.5 ? `${randInt(100)}%` : pick(rightTokens);
    }

    // 四隅ラベル
    cTL.element.textContent = 'LAT ' + (Math.sin(t * 0.03) * 45).toFixed(1).padStart(5, '+');
    cTR.element.textContent = 'LON ' + (Math.cos(t * 0.027) * 90).toFixed(1).padStart(5, '+');
    cBL.element.textContent = 'LOCK ' + (Math.floor(t / 15) % 2 ? '▮' : '▯');
    cBR.element.textContent = '0x' + randHex(4);

    // SYNC バー
    const s = Math.floor((Math.sin(t * 0.05) * 0.5 + 0.5) * 5);
    syncBar.element.textContent = '▰'.repeat(s) + '▱'.repeat(5 - s);
    syncPct.element.textContent = `${Math.floor((Math.sin(t * 0.05) * 0.5 + 0.5) * 99)}%`;

    // データストリーム
    if (t % 3 === 0) {
      stream.element.textContent = '> ' + randStream(9);
    }
  });
}

// パネル下部の中国うさぎ。画面内の敵数に応じて表情をクロスフェードで切り替える。
// （pixi スプライトで描画＝リザルトのキャプチャにも含まれる）
function UsagiFace(unit) {
  xpixi.nest(new PIXI.Container({ position: { x: PLAY_RIGHT + PANEL_W / 2, y: 596 } }));
  const urls = [0, 1, 2].map((i) => asset(`usagi0${i}.png`));

  let back = null, front = null, current = 0;

  xpixi.load(urls).then((loaded) => {
    const textures = urls.map((u) => loaded[u]);
    const fit = (s, t) => {
      s.texture = t;
      s.anchor.set(0.5, 1.0); // 下端中央
      s.scale.set(Math.min((PANEL_W * 1.12) / t.width, 380 / t.height));
    };
    back = xpixi.add(new PIXI.Sprite()); fit(back, textures[0]);
    front = xpixi.add(new PIXI.Sprite()); fit(front, textures[0]);

    // 0:余裕(〜30) 1:普通(〜60) 2:焦り(60〜)
    unit.on('update', () => {
      const count = xnew.find(Enemy).length;
      const idx = count <= 30 ? 0 : (count <= 60 ? 1 : 2);
      if (idx === current) return;

      fit(back, textures[current]); back.alpha = 1;
      fit(front, textures[idx]); front.alpha = 0;
      current = idx;
      xnew.transition(({ value }) => { front.alpha = value; }, 400, 'ease');
    });
  });
}

// 背景: zunda_background.png をやや暗めに加工 + 浮遊粒子（パララックス） + 薄い鼓動
function Background(unit) {
  xnew(BackgroundBase);
  for (let i = 0; i < 80; i++) xnew(Mote);
  xnew(PulseGlow);
}

function BackgroundBase(unit) {
  xpixi.nest(new PIXI.Container());

  // 下地（カメラシェイクで端が露出しても黒く抜けないよう少し広めに）
  xpixi.add(new PIXI.Graphics().rect(-40, -40, 880, 680).fill(0x0A0306));

  xpixi.load(asset('zunda_background.png')).then((texture) => {
    const sprite = xpixi.add(new PIXI.Sprite(texture));
    sprite.scale.set(800 / texture.width, 600 / texture.height); // canvas にフィット

    // やや暗め＆コントラスト緩和の暗幕 + 周辺減光を一枚のテクスチャに
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'rgba(8, 4, 10, 0.42)'; // 全体を暗くしてコントラストを抑える
    ctx.fillRect(0, 0, 800, 600);

    const vignette = ctx.createRadialGradient(400, 300, 210, 400, 300, 540);
    vignette.addColorStop(0.0, 'rgba(0, 0, 0, 0.0)');
    vignette.addColorStop(1.0, 'rgba(0, 0, 0, 0.55)'); // 周辺減光で視線を中央へ
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, 800, 600);

    xpixi.add(new PIXI.Sprite(PIXI.Texture.from(canvas)));
  });
}

// 奥行きのある浮遊粒子。下方向ドリフトで前進感、奥ほど小さく遅く暗い。
function Mote(unit) {
  const object = xpixi.nest(new PIXI.Container());
  object.position.set(Math.random() * 800, Math.random() * 600);

  const depth = Math.random(); // 0:奥 〜 1:手前
  const size = 1 + depth * 4;
  const baseAlpha = 0.08 + depth * 0.22;
  const color = pick([0xFF6E8A, 0xFFA7B6, 0xE8506A, 0xFFC0CB]);
  xpixi.add(new PIXI.Graphics().circle(0, 0, size).fill(color));

  const vy = 0.2 + depth * 0.9;
  const vx = randRange(-0.15, 0.15);
  let phase = randAngle();

  unit.on('update', () => {
    object.x += vx;
    object.y += vy;
    phase += 0.03;
    object.alpha = baseAlpha * (0.6 + 0.4 * Math.sin(phase)); // またたき

    if (object.y > 610) { object.y = -10; object.x = Math.random() * 800; }
    if (object.x < -10) object.x = 810;
    if (object.x > 810) object.x = -10;
  });
}

// ごく薄い鼓動グロー（体内感を残す）
function PulseGlow(unit) {
  const g = xpixi.nest(new PIXI.Graphics().rect(0, 0, 800, 600).fill(0xFF1733));
  unit.on('update', ({ count: tick }) => {
    g.alpha = (Math.max(0, Math.sin(tick * 0.05)) ** 8) * 0.06;
  });
}

function Controller(unit) {
  unit.on('touchstart contextmenu wheel window.keydown', (e) => e.event?.preventDefault());

  xnew(() => {
    xnew.nest('<div class="absolute left-0 right-0 bottom-0 w-full h-[30%] pointer-events-none" style="container-type: size;">');
    xnew.nest('<div class="absolute left-0 top-0 bottom-0 w-[100cqh] h-full">');
    const dpad = xnew('<div class="absolute inset-[5cqh]">', xbasics.DPad, {});
    dpad.on('-down -move -up', ({ vector }) => xnew.emit('+move', { vector }));
    dpad.on('pointerdown', ({ event }) => event.stopPropagation());
  });

  unit.on('pointerdown window.keydown.space', () => xnew.emit('+shot'));
  unit.on('window.keydown.arrow window.keyup.arrow window.keydown.wasd window.keyup.wasd', ({ vector }) => xnew.emit('+move', { vector }));
}

function ScoreManager(unit, { wave = 1 } = {}) {
  // 画面右上にスコアをコンピュータの解析表示風（等幅・ゼロ埋め）で表示。色は wave 連動。
  xnew.nest('<div class="absolute top-[1.6cqw] right-[26cqw] text-right" style="font-family: monospace;">');
  const label = xnew('<div class="text-[1.5cqw] tracking-[0.3em]">', 'SCORE');
  const text = xnew('<div class="text-[4.2cqw] leading-none font-bold">', '000000');

  function update({ wave }) {
    const c = waveCss(wave);
    label.element.style.color = c;
    text.element.style.color = c;
    text.element.style.textShadow = `0 0 0.8cqw ${c}, 0 0.1cqw 0.1cqw rgba(0,0,0,0.6)`;
  }
  let sum = 0;        // 合計スコア（リザルト表示用）
  let waveScore = 0;  // 現在の wave 内で稼いだスコア（wave 開始ごとに 0 リセット）
  const kills = ENEMIES.map(() => 0); // 敵 id 別の撃破数

  update({ wave });
  unit.on('+wave', update);
  unit.on('+wave', () => { waveScore = 0; }); // wave 開始ごとに wave 内スコアをリセット

  return {
    get score() { return sum; },
    get waveScore() { return waveScore; },
    get kills() { return kills; },
    add(score, id) {
      sum += score;
      waveScore += score;
      if (id !== undefined) kills[id]++;
      text.element.textContent = String(sum).padStart(6, '0');
    }
  };
}

function Player(unit) {
  const object = xpixi.nest(new PIXI.Container());
  object.position.set(PLAY_RIGHT / 2, 500);

  // 自機＝中国うさぎ（後ろ向きベイク）
  const sprite = xnew(BakedSprite, { textures: xnew.context(BakedCharacters).playerTextures, scale: 0.7 }).sprite;

  // 当たり判定を可視化する円（キャラの上に重ねて表示）
  const hitRing = xpixi.add(hitCircle(PLAYER_HIT_R, 0x33FFFF, 0.18, 2.5, 0.9));

  let alive = true;
  let velocity = { x: 0, y: 0 };
  unit.on('+move', ({ vector }) => velocity = vector);
  unit.on('+shot', () => {
    if (!alive) return;
    if (!xnew.context(ShotEnergy).tryConsume()) return; // エネルギー不足なら撃てない
    xnew.context(xbasics.Scene).add(Shot, { x: object.x, y: object.y });
    xnew.context(SoundFX).shot();
  });
  unit.on('+gameover', () => {
    if (!alive) return;
    alive = false;
    sprite.visible = false; // 自機を消して
    hitRing.visible = false;
    xnew.context(xbasics.Scene).add(PlayerExplosion, { x: object.x, y: object.y }); // 爆発
  });

  unit.on('update', ({ count }) => {
    if (!alive) return;
    object.x = Math.min(Math.max(object.x + velocity.x * 3, 30), PLAY_RIGHT - 30);
    object.y = Math.min(Math.max(object.y + velocity.y * 3, 30), 570);

    hitRing.alpha = 0.7 + 0.3 * Math.sin(count * 0.1); // うっすら明滅

    // 無敵でない敵に触れたらゲームオーバー
    hitNearestEnemy(object, PLAYER_HIT_R + ENEMY_HIT_R, () => xnew.emit('+gameover'), true);
  });
}

let _starTexture = null;

// 星ビジュアル component：共有テクスチャ + tint の Sprite を 1 枚持ち、回転とスケール変動（脈動 twinkle + 寿命に応じた縮み shrink）を内部計算。
// テクスチャは初回だけ焼いてキャッシュ。移動・フェード・当たり判定は呼び出し側の責務。共有テクスチャなので破棄時に texture を消さないこと。
function StarSprite(unit, { color, baseR, spin = 0.15, shrink = 0, twinkleAmp = 0, twinkleFreq = 0.6, life = 60 }) {
  // 星の共有テクスチャ（白）。初回に一度だけ焼き、以降は使い回す（同一テクスチャ + tint なのでバッチ描画が効く）。
  const STAR_TEX_R = 13; // テクスチャ内の星の基準半径。スケールは baseR / STAR_TEX_R。
 
  if (_starTexture === null) {
    const c = new PIXI.Container();
    // 下：少しブラーをかけた淡いグロー
    const glow = new PIXI.Graphics().star(0, 0, 5, STAR_TEX_R * 1.2, STAR_TEX_R * 0.55).fill({ color: 0xFFFFFF, alpha: 0.55 });
    glow.filters = [new PIXI.BlurFilter({ strength: 4 })];
    // 上：くっきりした不透明の星（5 角・内半径 0.45）＋ コントラスト用の縁取り
    const body = new PIXI.Graphics()
      .star(0, 0, 5, STAR_TEX_R, STAR_TEX_R * 0.45).fill({ color: 0xFFFFFF })
      .star(0, 0, 5, STAR_TEX_R, STAR_TEX_R * 0.45).stroke({ color: 0x3A2A12, width: 1.5 });
    c.addChild(glow, body);
    _starTexture = xpixi.renderer.generateTexture({ target: c, resolution: 2, antialias: true });
    c.destroy();
  }

  const sprite = xpixi.add(new PIXI.Sprite(_starTexture));
  sprite.anchor.set(0.5);
  sprite.tint = color;

  unit.on('update', ({ count }) => {
    sprite.rotation += spin;
    const p = count / life;
    const twinkle = 1 + Math.sin(count * twinkleFreq) * twinkleAmp;
    sprite.scale.set((baseR / STAR_TEX_R) * (1 - p * shrink) * twinkle);
  });
}

function Shot(unit, { x, y }) {
  const object = xpixi.nest(new PIXI.Container());
  object.position.set(x, y);

  // くっきりした星（回転 + 脈動）
  xnew(StarSprite, { color: 0x66FFFF, baseR: 18, spin: 0.15, twinkleAmp: 0.12, twinkleFreq: 0.6 });

  unit.on('update', () => {
    object.y -= 8;

    if (object.y < 0) { unit.finalize(); return; }

    // ショットは上方向。当たった敵を撃破して自身を消す。
    if (hitNearestEnemy(object, 30, (e) => e.clash(ENEMIES[e.id].score, { x: 0, y: -1 }))) {
      unit.finalize();
    }
  });

  return { get pixiObject() { return object; } };
}

// ---- Enemy system ----

function Enemy(unit, { id, x, y, invincible = false, knockback = null }) {
  const object = xpixi.nest(new PIXI.Container());
  // 自動出現は画面上部 20%（y ∈ [20,120]）のエリアに湧く。分裂はその場（x,y 指定）に出す。
  object.position.set(x ?? (20 + Math.random() * (PLAY_RIGHT - 40)), y ?? (20 + Math.random() * 100));

  // ベイクテクスチャでスプライト表示。scale 0 から pop-in（下の update で 0→1 に拡大）。
  const sprite = xnew(BakedSprite, { id, scale: 0, frame: 'random' }).sprite;

  // 当たり判定を可視化する円（object 直下なのでスケール変動の影響を受けない）
  xpixi.add(hitCircle(ENEMY_HIT_R, 0xFF3355, 0.2, 2, 0.85));

  // 出現時の pop-in（0→1）＋ スケールの時間変動（蠢く感）。DriftingFactor と同じ手法。
  const squirmPhase = randAngle();
  let pop = 0;

  // 無敵時間（分裂直後は半透明）
  let vulnerable = !invincible;
  if (invincible) {
    object.alpha = 0.5;
    xnew.timeout(() => { vulnerable = true; object.alpha = 1.0; }, 500);
  }

  // ランダムな速度（下向き成分を持つ。45~135度）
  const speed = randRange(0.7, 2.1);
  const angle = Math.PI * randRange(0.25, 0.75);
  const vel = { x: Math.cos(angle) * speed * randSign(), y: Math.sin(angle) * speed };

  // 被弾時のノックバック（着弾点から弾け、徐々に減速）
  const kb = { x: knockback?.x ?? 0, y: knockback?.y ?? 0 };

  let fading = false; // wave 切替で退場中（得点・当たり判定なし）

  unit.on('update', ({ count }) => {
    // pop-in（0→1）× y座標に応じた遠近感 × 蠢く拡縮
    pop = Math.min(1, pop + 0.08);
    sprite.scale.set((0.4 + id * 0.2 + object.y * 0.0008) * squirmFactor(count, squirmPhase, 0.08, 0.12) * pop);

    if (object.x < 15)             vel.x =  Math.abs(vel.x);
    if (object.x > PLAY_RIGHT - 15) vel.x = -Math.abs(vel.x);
    if (object.y < 15)  vel.y =  Math.abs(vel.y);
    if (object.y > 585) vel.y = -Math.abs(vel.y);
    object.position.set(object.x + vel.x + kb.x, object.y + vel.y + kb.y);
    kb.x *= 0.82;
    kb.y *= 0.82;
  });

  return {
    get id() { return id; },
    get isVulnerable() { return vulnerable && !fading; },

    distance(target) {
      const dx = target.x - object.x;
      const dy = target.y - object.y;
      return Math.sqrt(dx * dx + dy * dy);
    },

    // wave 切替時：得点を入れずにフェードアウトして退場
    fadeOut() {
      if (fading) return;
      fading = true;
      vulnerable = false;
      xnew.transition(({ value }) => { object.alpha = 1 - value; }, 500).timeout(() => unit.finalize());
    },

    // direction: 当たった方向の単位ベクトル（弾の進行方向）。fromStar: 星チェーン由来か。
    clash(score, direction = { x: 0, y: -1 }, fromStar = false) {
      if (fading) return; // 退場中は得点なし
      if (fromStar && !vulnerable) return; // 星チェーンは無敵中スキップ

      const data = ENEMIES[id];
      const scene = xnew.context(xbasics.Scene);
      const baseAngle = Math.atan2(direction.y, direction.x); // 当たった方向

      // 撃破エフェクト：衝撃バースト（敵が大きい id ほど強く）+ 撃破音。シェイクは自機ショット命中時のみ。
      scene.add(ExpandingBurst, { x: object.x, y: object.y, power: 1 + id * 0.5 });
      xnew.context(SoundFX).defeat(id);
      if (!fromStar) xnew.emit('+shake', { amount: 0.16 + id * 0.13 });

      // 倒された敵自身：半透明に薄れながら当たった方向へノックバックして消える
      scene.add(EnemyCorpse, {
        id, x: object.x, y: object.y, scale: sprite.scale.x, frame: sprite.currentFrame,
        direction, power: 6 + id * 1.5,
      });

      // 分裂（ノックバック方向を軸に小さくランダム微変動して弾ける）
      if (data.splitTo !== null) {
        for (let i = 0; i < 2; i++) {
          const dir = baseAngle + randRange(-0.3, 0.3);
          const power = 7 + id * 2;
          scene.add(Enemy, {
            id: data.splitTo, x: object.x, y: object.y, invincible: true,
            knockback: { x: Math.cos(dir) * power, y: Math.sin(dir) * power },
          });
        }
      }
      // 星（チェーンショット）— 当たった方向へ扇状に、敵が大きいほど多く
      const starCount = 3 + id;
      for (let i = 0; i < starCount; i++) {
        const angle = baseAngle + randRange(-0.7, 0.7);
        scene.add(Star, { x: object.x, y: object.y, score, angle });
      }
      scene.add(ScorePopup, { x: object.x, y: object.y, score });
      xnew.context(ScoreManager).add(score, id);
      unit.finalize();
    },
  };
}

function Star(unit, { x, y, score, angle = randAngle() }) {
  const object = xpixi.nest(new PIXI.Container());
  object.position.set(x, y);

  const baseR = randRange(9, 16) * 1.5;
  const color = pick([0xFFF066, 0xFFD700, 0xFFA53C, 0xFFFFFF, 0xFF8FD0, 0x9BE5FF]);
  const spin = randSign() * randRange(0.12, 0.32);
  // 縮みながら瞬く星（回転・スケール変動は component 内部で計算）
  xnew(StarSprite, { color, baseR, spin, shrink: 0.35, twinkleAmp: 0.22, twinkleFreq: 0.5 });

  const speed = randRange(2, 5);
  let vx = Math.cos(angle) * speed;
  let vy = Math.sin(angle) * speed;

  xnew.timeout(() => unit.finalize(), 900);

  unit.on('update', ({ count }) => {
    object.x += vx;
    object.y += vy;
    object.alpha = 1 - count / 60; // フェードは呼び出し側（コンテナ全体）で行う

    // 別の敵に当たると得点倍増（星の進行方向にノックバック/分裂）
    const hit = hitNearestEnemy(object, 28, (e) => {
      const len = Math.hypot(vx, vy) || 1;
      e.clash(score + 2, { x: vx / len, y: vy / len }, true);
    }, true);
    if (hit) unit.finalize();
  });
}

function ScorePopup(unit, { x, y, score }) {
  const object = xpixi.nest(new PIXI.Text({ text: `+${score}`, style: { fontSize: 22, fill: 0xFFFF44, fontWeight: 'bold' } }));
  object.position.set(x, y);
  object.anchor.set(0.5);

  // 上へ 40px 浮かびながらフェードアウトし、終端で finalize（約1秒）。
  xnew.transition(({ value: p }) => {
    object.y = y - 40 * p;
    object.alpha = 1 - p;
  }, 1000).timeout(() => unit.finalize());
}

// 倒された敵のノックバック表現：薄れながら当たった方向へ飛んで消える
function EnemyCorpse(unit, { id, x, y, scale, frame = 0, direction, power }) {
  const object = xpixi.nest(new PIXI.Container({ position: { x, y } }));

  xnew(BakedSprite, { id, scale, frame, play: false }); // コープスは再生せず1フレーム固定

  const angle = Math.atan2(direction.y, direction.x);
  let vx = Math.cos(angle) * power;
  let vy = Math.sin(angle) * power;
  const spin = randRange(-0.15, 0.15);

  const DURATION = 26;
  unit.on('update', ({ count }) => {
    object.x += vx;
    object.y += vy;
    vx *= 0.86;
    vy *= 0.86;
    object.rotation += spin;
    object.alpha = Math.max(0, 1 - count / DURATION); // 半透明に薄れる
    if (count >= DURATION - 1) unit.finalize();
  });
}

// 広がるフラッシュ + リングのバースト演出。(x,y) にコンテナを nest し duration フレーム後に finalize。
// flash/ring は { r, alpha, grow, fade(p) }（ring.width=線幅）。省略時は power から標準の撃破バーストを作る。
function ExpandingBurst(unit, { x, y, duration = 16, power = 1, flash, ring }) {
  flash = flash ?? { r: 16 * power, alpha: 0.9, grow: 0.6, fade: (p) => 0.9 * (1 - p) };
  ring = ring ?? { r: 10 * power, width: 4, alpha: 0.9, grow: 2.4, fade: (p) => 0.9 * (1 - p) };
  xpixi.nest(new PIXI.Container({ position: { x, y } }));
  const flashG = xpixi.add(new PIXI.Graphics().circle(0, 0, flash.r).fill({ color: 0xFFFFFF, alpha: flash.alpha }));
  const ringG = xpixi.add(new PIXI.Graphics().circle(0, 0, ring.r).stroke({ color: 0x66E0FF, width: ring.width, alpha: ring.alpha }));
  // duration は従来どおりフレーム数指定。0→1 を duration フレーム相当の時間で動かし、終端で finalize。
  xnew.transition(({ value: p }) => {
    flashG.scale.set(1 + p * flash.grow);
    flashG.alpha = flash.fade(p);
    ringG.scale.set(1 + p * ring.grow);
    ringG.alpha = ring.fade(p);
  }, duration * (1000 / 60)).timeout(() => unit.finalize());
}

// 自機被弾時の爆発エフェクト：白フラッシュ + 広がるリング + 飛び散る破片
function PlayerExplosion(unit, { x, y }) {
  const DURATION = 36;
  // ExpandingBurst が (x,y) にコンテナを nest する（以降の破片もその nest 直下）。
  xnew.extend(ExpandingBurst, {
    x, y,
    duration: DURATION,
    flash: { r: 30, alpha: 1, grow: 1.5, fade: (p) => Math.max(0, 1 - p * 2) },
    ring: { r: 18, width: 6, alpha: 1, grow: 3.5, fade: (p) => Math.max(0, 1 - p) },
  });

  // 飛び散る破片（PlayerExplosion 固有。flash/ring の後に追加して前面に出す）
  const palette = [0x9CF0FF, 0xFFFFFF, 0x66E0FF, 0xCFFBFF];
  const shards = [];
  for (let i = 0; i < 18; i++) {
    const g = xpixi.add(new PIXI.Graphics().circle(0, 0, randRange(3, 7)).fill(pick(palette)));
    const a = randAngle();
    const sp = randRange(3, 9);
    shards.push({ g, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp });
  }
  unit.on('update', ({ count }) => {
    const p = count / DURATION;
    for (const s of shards) {
      s.g.x += s.vx;
      s.g.y += s.vy;
      s.vx *= 0.92;
      s.vy = s.vy * 0.92 + 0.15; // 減速 + 重力
      s.g.alpha = Math.max(0, 1 - p);
    }
  });
}

// カメラシェイク：トラウマ値を撃破時に加算し、二乗で減衰しながら scene を揺らす
function CameraShake(unit) {
  let trauma = 0;
  unit.on('+shake', ({ amount = 0.3 }) => { trauma = Math.min(1, trauma + amount); });
  unit.on('update', () => {
    if (trauma > 0) {
      const shake = trauma * trauma;
      const max = 14;
      xpixi.scene.position.set((Math.random() * 2 - 1) * max * shake, (Math.random() * 2 - 1) * max * shake);
      trauma = Math.max(0, trauma - 0.06);
    } else if (xpixi.scene.x !== 0 || xpixi.scene.y !== 0) {
      xpixi.scene.position.set(0, 0);
    }
  });
  unit.on('finalize', () => xpixi.scene.position.set(0, 0));
}

// ショットエネルギー：連射を抑制（満タンから2発、約2.4秒で全回復）。右下にサイバーな表示。
function ShotEnergy(unit) {
  const MAX = 100;
  const COST = 50;            // 1発の消費（満タンから約2発）
  const RECOVER = MAX / 144;  // 1フレームあたり（60fps で約2.4秒に全回復）。色はショットと同じ #22FFFF
  let energy = MAX;

  xnew.nest('<div class="absolute bottom-[2.5cqw] right-[27cqw] w-[24cqw] pointer-events-none" style="font-family: monospace;">');

  // ラベル行（SHOT ENERGY + ステータス）
  let statusEl;
  xnew('<div class="flex justify-between items-end text-[1.4cqw] tracking-[0.2em] mb-[0.3cqw]" style="color:#22FFFF; text-shadow:0 0 0.5cqw rgba(34,255,255,0.6);">', () => {
    xnew('<div>', '◣ SHOT ENERGY');
    statusEl = xnew('<div class="text-[1.3cqw]">', 'READY');
  });

  // メーター本体（枠＋グロー＋セグメント＋走査＋目盛り）。走査はセグメントの下、目盛りは最前面。
  const bar = xnew(CyberBar, {
    boxClass: 'h-[2cqw] bg-black/55',
    boxStyle: 'outline:0.15cqw solid #22FFFF; box-shadow:0 0 1.2cqw rgba(34,255,255,0.45), inset 0 0 0.6cqw rgba(34,255,255,0.25);',
    fillWidth: '100%',
    fillStyle: 'background:linear-gradient(180deg,#bdffff,#22FFFF 55%,#0aacac);',
    segment: [2, 2.5],
    scanW: 2, scanAlpha: 0.75, scanOnTop: false, scanSpeed: 0.05, scanMargin: 8,
    extra: () => xnew('<div class="absolute top-0 left-0 right-0 h-[0.4cqw]" style="background:repeating-linear-gradient(90deg, #22FFFF 0 0.15cqw, transparent 0.15cqw 1cqw); opacity:0.5;">'), // 上辺の目盛り
  });

  unit.on('update', ({ count: t }) => {
    energy = Math.min(MAX, energy + RECOVER);
    const pct = energy / MAX;
    const ready = energy >= COST;

    bar.setFill(pct);
    bar.fill.element.style.opacity = ready ? '1' : '0.45';
    statusEl.element.textContent = ready ? 'READY' : 'CHARGE';
    statusEl.element.style.color = ready ? '#22FFFF' : '#ff5577';
    statusEl.element.style.opacity = ready ? '1' : `${Math.floor(t / 12) % 2 ? 1 : 0.3}`; // CHARGE 中は点滅
  });

  return {
    tryConsume() {
      if (energy < COST) return false;
      energy -= COST;
      return true;
    },
  };
}

// 効果音：ショット音と撃破音（ピン、というピアノ風のシンセ音）
function SoundFX(unit) {
  // ショット：高めで少し下がるピッ
  const shotSynth = xnew(xbasics.Synthesizer, {
    oscillator: { type: 'triangle', envelope: { amount: -7, ADSR: [0, 90, 0, 0] } },
    filter: { type: 'lowpass', cutoff: 3500 },
    amp: { envelope: { amount: 0.3, ADSR: [0, 110, 0, 0] } },
  });
  // 撃破：ピン（ピアノ風の余韻のある短い音）。敵 id ごとに音程を変える。
  const pinSynth = xnew(xbasics.Synthesizer, {
    oscillator: { type: 'triangle' },
    filter: { type: 'lowpass', cutoff: 5000 },
    amp: { envelope: { amount: 0.8, ADSR: [2, 350, 0, 0] } },
    reverb: { time: 1000, mix: 0.25 },
  });
  const pinNotes = ['C5', 'E5', 'G5', 'C6'];

  let lastShot = 0;
  let lastDefeat = 0;
  return {
    shot() {
      const now = Date.now();
      if (now - lastShot < 60) return;
      lastShot = now;
      shotSynth.press('A5', 60);
    },
    defeat(id) {
      const now = Date.now();
      if (now - lastDefeat < 35) return; // 連鎖の音被りを軽減
      lastDefeat = now;
      pinSynth.press(pinNotes[Math.min(id, pinNotes.length - 1)], 200);
    },
  };
}

// ---- Result screen ----

// 敵アイコン（ベイク先頭フレーム＝正面）の dataURL の Promise。初回のリザルトで一度だけ抽出してキャッシュする。
let _enemyIcons = null;

function ResultDetail(unit, { score, wave, kills = [0, 0, 0, 0], cleared = false }) {
  xnew.nest('<div class="absolute inset-x-0 bottom-[2cqw] mx-auto w-[38cqw] bg-gray-100 px-[1.5cqw] py-[2.5cqw] rounded-[1cqw] font-bold" style="box-shadow: 0 8px 20px rgba(0,0,0,0.2);">');
  xnew('<div class="text-[3.5cqw] text-center text-red-400 mb-[1.5cqw]">', '🦠 駆逐した数 🦠');

  // 敵キャラ別の撃破数（アイコン × 撃破数）を2列で
  _enemyIcons = _enemyIcons ?? xnew.context(BakedCharacters).texturesList.map((textures) => {
    const sprite = new PIXI.Sprite(textures[0]);
    return xpixi.renderer.extract.base64(sprite).finally(() => sprite.destroy());
  });
  xnew('<div class="grid grid-cols-2 gap-x-[1cqw] gap-y-[1.5cqw]">', () => {
    _enemyIcons.forEach((iconSrc, i) => {
      xnew('<div class="flex items-center justify-center gap-x-[1cqw]">', () => {
        const icon = xnew('<img class="w-[7cqw] h-[7cqw] object-contain">');
        iconSrc.then((src) => icon.element.src = src);
        xnew('<div class="text-[3.5cqw] text-cyan-700">', `× ${kills[i] ?? 0}`);
      });
    });
  });

  xnew('<div class="mx-[1cqw] my-[2cqw] border-t-[0.4cqw] border-dashed border-cyan-600">');
  if (cleared) {
    xnew('<div class="text-[3.2cqw] text-center text-amber-500 mb-[1cqw]">', '🏆 達成 Wave 4 CLEAR 🏆');
  } else {
    xnew('<div class="text-[2.8cqw] text-center text-cyan-600 mb-[1cqw]">', `到達 Wave ${wave}`);
  }
  xnew('<div class="text-[3.4cqw] text-center text-yellow-500 mb-[1.5cqw]">', `⭐ スコア ${score} ⭐`);

  // 凄さを言葉で（3択。スコアで強調を切替）
  xnew('<div class="flex justify-center items-center gap-x-[2cqw]">', () => {
    const tiers = [{ label: 'まだ弱い', min: 0 }, { label: 'ふつう', min: 1024 * 3 }, { label: 'すごい', min: 1024 * 6 }];
    let reached = 0;
    tiers.forEach((tier, i) => { if (score >= tier.min) reached = i; });
    tiers.forEach((tier, i) => {
      xnew(i === reached ? '<div class="text-[3.2cqw] text-blue-500">' : '<div class="text-[2cqw] opacity-20">', tier.label);
    });
  });
}

// ---- UI parts (title / result / volume) ----

// 丸枠アイコン: 外周の円 + 中央70%に path 群。Camera / ArrowUturnLeft で共有。
function RingIcon(unit, { paths }) {
  xnew('<div style="position: absolute; inset: 0; margin: auto; width: 100%; height: 100%;">', () => {
    xnew.extend(xbasics.SVG, { viewBox: '0 0 24 24', stroke: 'currentColor' });
    xnew('<circle cx="12" cy="12" r="11">');
  });
  xnew('<div style="position: absolute; inset: 0; margin: auto; width: 70%; height: 70%;">', () => {
    xnew.extend(xbasics.SVG, { viewBox: '0 0 24 24', stroke: 'currentColor', strokeWidth: 1.5 });
    for (const d of paths) {
      xnew(`<path d="${d}">`);
    }
  });
}

function Camera(_unit) {
  xnew.extend(RingIcon, { paths: [
    'M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23q-.57.08-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a48 48 0 0 0-1.134-.175a2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.19 2.19 0 0 0-1.736-1.039a49 49 0 0 0-5.232 0a2.19 2.19 0 0 0-1.736 1.039z',
    'M16.5 12.75a4.5 4.5 0 1 1-9 0a4.5 4.5 0 0 1 9 0m2.25-2.25h.008v.008h-.008z',
  ] });
}

function ArrowUturnLeft(_unit) {
  xnew.extend(RingIcon, { paths: ['M9 15L3 9m0 0l6-6M3 9h12a6 6 0 0 1 0 12h-3'] });
}

// 生成時に渡された要素を白で覆ってからフェードアウトしつつ撮影し、PNG をダウンロードする。
function ScreenShot(unit) {
  const cover = xnew('<div class="absolute inset-0 size-full z-10 bg-white">');
  xnew.transition(({ value }) => cover.element.style.opacity = 1 - value, 1000)
    .timeout(() => {
      html2canvas(unit.element, { scale: 2, logging: false, useCORS: true }).then((canvas) => {
        // 下部のフッターを除いた領域を切り出して PNG としてダウンロードする。
        const [width, height] = [canvas.width, Math.floor(canvas.height * (1 - RESULT_FOOTER_RATIO))];
        const cropped = document.createElement('canvas');
        [cropped.width, cropped.height] = [width, height];
        cropped.getContext('2d').drawImage(canvas, 0, 0, width, height, 0, 0, width, height);
        const link = document.createElement('a');
        link.download = 'image.png';
        link.href = cropped.toDataURL('image/png');
        link.click();
      });
      unit.finalize();
    });
}

// リザルトのフッター。「画面を保存」(ScreenShot) と「戻る」(タイトルへシーン遷移) の2ボタン。
function ResultFooter(unit) {
  xnew.nest('<div class="size-full px-[2cqw] flex justify-between text-stone-500">');
  xnew('<div class="flex items-center gap-x-[2cqw]">', () => {
    const button = xnew('<div class="relative size-[9cqw] cursor-pointer hover:scale-110">', Camera);
    button.on('click', () => xnew(document.querySelector('#main'), ScreenShot));
    xnew('<div class="text-[3cqw] font-bold">', '画面を保存');
  });

  xnew('<div class="flex items-center gap-x-[2cqw]">', () => {
    xnew('<div class="text-[3cqw] font-bold">', '戻る');
    const button = xnew('<div class="relative size-[9cqw] cursor-pointer hover:scale-110">', ArrowUturnLeft);
    button.on('click', () => xnew.context(xbasics.Scene).change(TitleScene, { skipStory: true }));
  });
}

// リザルト背景：斜めグラデ + 大きな "Result" + 漂う/瞬く白丸。
// gradient="from-... to-..."（bg-linear-to-br 用）/ textColor="text-..."。
function ResultBackground(unit, { gradient, textColor }) {
  xnew.nest(`<div class="absolute inset-0 size-full bg-linear-to-br ${gradient}">`);
  xnew(`<div class="absolute top-0 left-[4cqw] text-[14cqw] ${textColor}">`, 'Result');

  // ランダム配置した白丸を sin で明滅させる。transform は種類ごとに変える（浮遊 / きらめき）。
  function floatingCircle(sizeCqw, transform) {
    const [x, y] = [Math.random() * 100, Math.random() * 100];
    const circle = xnew(`<div class="absolute rounded-full bg-white" style="width: ${sizeCqw}cqw; height: ${sizeCqw}cqw; left: ${x}%; top: ${y}%; opacity: 0.2;">`);
    circle.on('update', ({ count }) => {
      const p = count * 0.02;
      Object.assign(circle.element.style, { opacity: Math.sin(p) * 0.1 + 0.2, transform: transform(p) });
    });
  }

  for (let i = 0; i < 20; i++) {
    floatingCircle(Math.random() * 2 + 2, (p) => `translateY(${Math.sin(p) * 20}px)`);
  }
  for (let i = 0; i < 30; i++) {
    floatingCircle(1, (p) => `scale(${1 + Math.sin(p) * 0.1})`);
  }
}

// タイトルの見出し（縁取り SVGText）。text=文言 / color="text-..."。
function TitleText(unit, { text, color }) {
  xnew.nest(`<div class="absolute w-full top-[16cqw] text-center ${color} font-bold">`);
  xnew(xbasics.SVGText, { text, fontSize: '10cqw', stroke: '#EEEEEE', strokeWidth: '0.2cqw', className: 'inline-block' });
}

// 点滅する "touch start"。color="text-..."。
function TouchMessage(unit, { color }) {
  xnew.nest(`<div class="absolute w-full top-[30cqw] text-center ${color} font-bold">`);
  xnew(xbasics.SVGText, { text: 'touch start', fontSize: '6cqw', stroke: '#EEEEEE', strokeWidth: '0.2cqw', className: 'inline-block' });
  unit.on('update', ({ count }) => unit.element.style.opacity = 0.6 + Math.sin(count * 0.08) * 0.4);
}

// 中央に降りてくる "Game Over"。className で横位置を調整（既定は全幅中央）。
function GameOverText(unit, { className = 'w-full' }) {
  xnew.nest(`<div class="absolute ${className} text-center text-red-400 font-bold">`);
  xnew(xbasics.SVGText, { text: 'Game Over', fontSize: '12cqw', stroke: '#EEEEEE', strokeWidth: '0.2cqw', className: 'inline-block' });
  xnew.transition(({ value }) => {
    Object.assign(unit.element.style, { opacity: value, top: `${10 + value * 15}cqw` });
  }, 1000, 'ease');
}

// スピーカーアイコン（muted で消音グリフに切り替わる）。
function SpeakerIcon(unit, { muted = false } = {}) {
  xnew.extend(xbasics.SVG, { viewBox: '0 0 24 24', stroke: 'currentColor', strokeWidth: 1.5 });
  const path = muted
    ? 'M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9 9 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25z'
    : 'M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9 9 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25z';
  xnew(`<path d="${path}" />`);
}

// スピーカーアイコン + アンカー方向に開くスライダー。xbasics.Volume をマスター音量への橋渡しに使う。
function VolumeController(unit, { anchor = 'left' } = {}) {
  const volume = xnew.extend(xbasics.Volume);
  xnew.extend(xbasics.Aspect, { aspect: 1.0, fit: 'contain' });
  unit.on('pointerdown', ({ event }) => event.stopPropagation());

  const system = xnew(xbasics.OpenAndClose, { open: false, duration: 250, easing: 'ease' });

  const button = xnew((unit) => {
    xnew.nest('<div style="width: 100%; height: 100%; cursor: pointer;">');
    unit.on('click', () => system.toggle());
    let icon = xnew(SpeakerIcon, { muted: volume.volume === 0 });
    return {
      update() {
        icon?.finalize();
        icon = xnew(SpeakerIcon, { muted: volume.volume === 0 });
      }
    };
  });

  xnew(() => {
    const isHoriz = anchor === 'left' || anchor === 'right';
    const cqUnit = isHoriz ? 'cqw' : 'cqh';
    const fillProp = isHoriz ? 'width' : 'height';
    const pct = volume.volume * 100;

    const outerSize = isHoriz ? `top: 20%; bottom: 20%; width: 0${cqUnit}` : `left: 20%; right: 20%; height: 0${cqUnit}`;
    const fillSize = isHoriz ? `top: 0; left: 0; bottom: 0; width: ${pct}%; height: 100%` : `bottom: 0; left: 0; right: 0; width: 100%; height: ${pct}%`;

    const outer = xnew.nest(`<div style="position: absolute; ${outerSize};">`);
    xnew.nest(`<div style="position: relative; width: 100%; height: 100%; border: 1px solid currentColor; border-radius: 0.25em; box-sizing: border-box;">`);

    const fill = xnew(`<div style="position: absolute; ${fillSize}; background: color-mix(in srgb, currentColor 20%, transparent);">`);
    const input = xnew(`<input type="range" min="0" max="100" value="${pct}" style="position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; margin: 0;${isHoriz ? '' : ' writing-mode: vertical-lr; direction: rtl;'}">`);

    input.on('input', ({ event }) => {
      const v = Number(event.target.value);
      fill.element.style[fillProp] = `${v}%`;
      volume.volume = v / 100;
      button.update();
    });

    system.on('-transition', ({ value }) => {
      outer.style[anchor] = `-${value * 400 + 20}${cqUnit}`;
      outer.style[fillProp] = `${value * 400}${cqUnit}`;
      outer.style.opacity = value.toString();
      outer.style.pointerEvents = value < 0.9 ? 'none' : 'auto';
    });
  });

  unit.on('click.outside', () => system.close());
}

// 右下の音量コントローラ。className で文字色等を調整。
function VolumeControl(unit, { className = 'text-stone-300 z-10' } = {}) {
  xnew(`<div class="absolute right-[2cqw] bottom-[2cqw] size-[6cqw] ${className}">`,
    VolumeController, { anchor: 'left' });
}

