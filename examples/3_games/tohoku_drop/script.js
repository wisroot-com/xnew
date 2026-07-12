import * as PIXI from 'pixi.js';
import Matter from 'matter-js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import voxelkit from 'voxelkit';
import { xnew, xbasics, xicons } from '@mulsense/xnew';
import { xpixi } from '@mulsense/xnew/addons/xpixi';
import { xthree } from '@mulsense/xnew/addons/xthree';
import { xmatter } from '@mulsense/xnew/addons/xmatter';
import html2canvas from 'html2canvas-pro';

xnew(document.querySelector('#main'), Main);

function Main(unit) {
  const [width, height] = [800, 600];
  xnew.extend(xbasics.Screen, { width, height });

  // setup three 
  xthree.initialize({ canvas: new OffscreenCanvas(width, height) });
  xthree.renderer.shadowMap.enabled = true;
  xthree.camera.position.set(0, 0, +10);

  // pixi setup
  xpixi.initialize({ canvas: unit.canvas });

  xnew.promise(unit).then(() => {
    const texture = PIXI.Texture.from(xthree.canvas);
    unit.on('update', () => {
      xthree.renderer.render(xthree.scene, xthree.camera);
      texture.source.update();
      xpixi.renderer.render(xpixi.scene);
    });

    xnew(Contents);
  });
}

function Contents(unit) {
  xnew(GameData);
  xnew(TitleScene);
}

function GameData(unit) {
  let scores = [0, 0, 0, 0, 0, 0, 0, 0];

  return {
    get scores() {
      return scores;
    },
    reset() {
      scores = [0, 0, 0, 0, 0, 0, 0, 0];
    },
  }
}

function TitleScene(unit) {
  xnew.extend(xbasics.Scene);

  xnew(xbasics.Image, { src: './background.jpg', className: 'absolute inset-0 size-full -z-10 object-fill' });
  xnew(ShadowPlane);
  xnew(DirectionalLight, { x: 2, y: 12, z: 20 });
  xnew(AmbientLight);

  for (let id = 0; id < 7; id++) {
    const position = xthree.coord2dTo3d(140 + id * 90, 450);
    const rotation = { x: 10 / 180 * Math.PI, y: (-10 - 3 * id) / 180 * Math.PI, z: 0 };
    xnew(Model, { position, rotation, id, scale: 0.8 });
  }
  xnew(ThreeTexture); // render three.js canvas as pixi texture
  unit.on('pointerdown', () => unit.change(GameScene));

  xnew(TitleText, { text: 'とーほくドロップ', color: 'text-green-600' });
  xnew(TouchMessage, { color: 'text-green-600' });
  xnew(VolumeControl, { className: 'text-stone-500' });
}

function GameScene(unit) {
  xnew.extend(xbasics.Scene);
  
  xmatter.initialize();
  unit.on('update', () => {
    Matter.Engine.update(xmatter.engine);
  });
  xnew.context(GameData).reset();
  
  xnew(xbasics.Image, { src: './background.jpg', className: 'absolute inset-0 size-full -z-10 object-fill' });
  xnew(ShadowPlane);
  xnew(DirectionalLight, { x: 2, y: 5, z: 10 });
  xnew(AmbientLight);
  xnew(Bowl);
  xnew(Cursor);
  xnew(Queue);
  xnew(ThreeTexture); // render three.js canvas as pixi texture
  xnew(ScoreText);
  xnew(VolumeControl, { className: 'text-stone-500' });

  const playing = xnew((unit) => {
    xnew(Controller);
    xnew(xbasics.AudioTrack, { url: '../../assets/y015.mp3' }).play({ fade: 1000, loop: true });
  })

  // xnew.timeout(() => xnew.emit('+gameover'), 1100);

  unit.once('+gameover', () => {
    playing.finalize();
    const gameover = xnew(GameOverText);

    // 背景が DOM(xbasics.Image) になり pixi extract では写らないため、html2canvas で画面ごと撮る。
    xpixi.renderer.render(xpixi.scene); // preserveDrawingBuffer なしでも同一タスク内の描画直後なら canvas が写る
    const image = html2canvas(document.querySelector('#main'), {
      scale: 2, logging: false, useCORS: true,
      ignoreElements: (element) => element === gameover.element,
    }).then((canvas) => canvas.toDataURL('image/png'));

    xnew.timeout(() => {
      unit.change(ResultScene, { image });
    }, 2000);
  });
}

function ResultScene(unit, { image }) {
  xnew.extend(xbasics.Scene);
  
  xnew(xbasics.AudioTrack, { url: '../../assets/st005.mp3' }).play({ fade: 1, loop: true });

  // popup
  xnew.nest(`<div class="absolute inset-0 size-full">`);
  xnew.transition(({ value }) => {
    Object.assign(unit.element.style, { opacity: value, transform: `scale(${0.8 + value * 0.2})` });
  }, 500, 'ease');

  xnew(ResultBackground, { gradient: 'from-stone-300 to-stone-400', textColor: 'text-stone-400' });
  xnew(xbasics.Image, { src: image, className: 'absolute bottom-[12cqw] left-[2cqw] size-[45cqw] rounded-[1cqw] object-cover', style: 'box-shadow: 0 10px 30px rgba(0,0,0,0.3);' });
  xnew(ResultDetail);
  xnew(ResultFooter, { onBack: () => unit.change(TitleScene) });
}

function ThreeTexture(unit) {
  const texture = PIXI.Texture.from(xthree.canvas)
  const object = xpixi.nest(new PIXI.Sprite(texture));
}

function ScoreText(unit) {
  xnew.nest('<div class="absolute top-[1cqw] right-[2cqw] w-full text-right text-green-600 font-bold">');
  const text = xnew(xbasics.SVGText, { text: 'score 0', fontSize: '6cqw', style: 'stroke: #EEEEEE; stroke-width: 0.2cqw;', className: 'inline-block' });
  let sum = 0;
  unit.on('+scoreup', ({ score }) => {
    text.element.textContent = `score ${sum += Math.pow(2, score)}`;
    xnew.context(GameData).scores[score]++;
  });
}

function ResultDetail(unit) {
  xnew.nest('<div class="absolute bottom-[12cqw] right-[2cqw] w-[50cqw] bg-gray-100 p-[1cqw] rounded-[1cqw] font-bold" style="box-shadow: 0 8px 20px rgba(0,0,0,0.2);">');
  xnew('<div class="text-[4cqw] text-center text-red-400">', '🎉 生み出した数 🎉');

  const characters = ['ずんだもん', '中国うさぎ', '東北きりたん', '四国めたん', '東北ずん子', '九州そら', '東北イタコ', '大ずんだもん'];
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    const score = xnew.context(GameData).scores[i];
    sum += score * Math.pow(2, i);
    xnew('<div class="text-[3cqw] text-green-600 text-center">', `${characters[i]}: ${Math.pow(2, i)}点 x ${score}`);
  }

  xnew('<div class="mx-[2cqw] my-[1cqw] border-t-[0.4cqw] border-dashed border-green-600">');
  xnew('<div class="text-[4cqw] text-center text-yellow-500">', `⭐ 合計スコア: ${sum} ⭐`);
  xnew('<div class="pt-[1.5cqw] px-[1cqw] flex justify-center items-center gap-x-[2cqw]">', () => {
    ['まだよわい', 'ふつう', 'すごい'].forEach((text, i) => {
      if (sum >= i * 300 && (sum < (i + 1) * 300 || i >= 2)) {
        xnew('<div class="text-[3.5cqw] text-blue-500">', text);
      } else {
        xnew('<div class="text-[2cqw] opacity-20">', text);
      }
    });
  });
}

function DirectionalLight(unit, { x, y, z }) {
  const object = xthree.nest(new THREE.DirectionalLight(0xFFFFFF, 1.7));
  object.position.set(x, y, z);
  object.castShadow = true;
}

function AmbientLight(unit) {
  const object = xthree.nest(new THREE.AmbientLight(0xFFFFFF, 1.2));
}

function ShadowPlane(unit) {
  const geometry = new THREE.PlaneGeometry(16, 14);
  const material = new THREE.ShadowMaterial({ opacity: 0.25 });
  const plane = xthree.nest(new THREE.Mesh(geometry, material));
  plane.receiveShadow = true;
  plane.rotation.x = -Math.PI / 2;
  plane.position.set(0.0, -2.9, -2.0);
}

function Controller(unit) {
  unit.on('pointermove pointerdown', ({ position }) => {
    xnew.emit('+move', { x: position.x * xpixi.canvas.width / xpixi.canvas.clientWidth });
  });
  unit.on('pointerdown', () => xnew.emit('+drop'));
}

function Bowl(unit) {
  for (let angle = 10; angle <= 170; angle++) {
    const x = 400 + Math.cos(angle * Math.PI / 180) * 240;
    const y = 360 + Math.sin(angle * Math.PI / 180) * 200;
    xnew(Circle, { x, y, radius: 12, color: 0x99AAAA, options: { isStatic: true } });
  }
}

function Queue(unit) {
  const balls = [...Array(4)].map(() => Math.floor(Math.random() * 3));
  xnew.emit('+relode:done', { id: 0 });

  const position = xthree.coord2dTo3d(10 + 70, 70);
  const rotation = { x: 30 / 180 * Math.PI, y: 60 / 180 * Math.PI, z: 0 };
  let model = xnew(Model, { position, rotation, id: balls[0], scale: 0.6 });

  unit.on('+reload', () => {
    const position = xthree.coord2dTo3d(10, 70);
    const rotation = { x: 30 / 180 * Math.PI, y: 60 / 180 * Math.PI, z: 0 };
    model.finalize();
    model = xnew(Model, { position, rotation, id: balls[1], scale: 0.6 });

    balls.push(Math.floor(Math.random() * 3));
    xnew.transition(({ value }) => {
      const position = xthree.coord2dTo3d(10 + value * 70, 70);
      model.threeObject.position.set(position.x, position.y, position.z);
    }, 500).timeout(() => xnew.emit('+relode:done', { id: balls.shift() }));
  });
}

function Model(unit, { id = 0, position = null, rotation = null, scale }) {
  const object = xthree.nest(new THREE.Object3D());
  if (position) object.position.set(position.x, position.y, position.z);
  if (rotation) object.rotation.set(rotation.x, rotation.y, rotation.z);

  const list = ['zundamon.mog', 'usagi.mog', 'kiritan.mog', 'metan.mog', 'zunko.mog', 'sora.mog', 'itako.mog'];
  const path = '../../assets/' + (id < 7 ? list[id] : list[0]);

  xnew.promise(voxelkit.load(path, { scale: 100 }))
    .then((composits) => voxelkit.convertVRM(composits[0]))
    .then((arrayBuffer) => new Promise((resolve) => {
      const loader = new GLTFLoader();
      loader.register((parser) => new VRMLoaderPlugin(parser));
      loader.parse(arrayBuffer.buffer, '', (gltf) => resolve(gltf));
    }))
    .then((gltf) => {
      const vrm = gltf.userData.vrm;
      vrm.scene.traverse((object) => {
        if (object.isMesh) object.castShadow = object.receiveShadow = true;
      });
      vrm.scene.position.y = -scale;
      vrm.scene.scale.set(scale, scale, scale);
      object.add(vrm.scene);

      const random = Math.random() * 10;

      let count = 0;
      unit.on('update', () => {
        const t = (count + random) * 0.03;
        const g = (name) => vrm.humanoid.getNormalizedBoneNode(name);
        g('neck').rotation.x = Math.sin(t * 6) * +0.1;
        g('chest').rotation.x = Math.sin(t * 12) * +0.1;
        g('hips').position.z = Math.sin(t * 12) * 0.1;
        g('leftUpperArm').rotation.z = Math.sin(t * 12 + random) * +0.7;
        g('leftUpperArm').rotation.x = Math.sin(t * 6 + random) * +0.8;
        g('rightUpperArm').rotation.z = Math.sin(t * 12) * -0.7;
        g('rightUpperArm').rotation.x = Math.sin(t * 6) * +0.8;
        g('leftUpperLeg').rotation.z = Math.sin(t * 8) * +0.2;
        g('leftUpperLeg').rotation.x = Math.sin(t * 12) * +0.7;
        g('rightUpperLeg').rotation.z = Math.sin(t * 8) * -0.2;
        g('rightUpperLeg').rotation.x = Math.sin(t * 12) * -0.7;
        vrm.update(t);
        count++;
      });
    });
  return { 
    get id() { return id; },
  };
}

function Cursor(unit) {
  const object = xpixi.nest(new PIXI.Container({ position: { x: 400, y: 40 } }));

  const graphics = new PIXI.Graphics();
  graphics.moveTo(-24, 0).lineTo(24, 0).stroke({ color: 0xE84A57, width: 12 })
  graphics.moveTo(0, -24).lineTo(0, 24).stroke({ color: 0xE84A57, width: 12 });
  object.addChild(graphics);

  unit.on('+move', ({ x }) => object.x = Math.max(Math.min(x, xpixi.canvas.width / 2 + 190), xpixi.canvas.width / 2 - 190));

  const offset = 50;
  let model = null
  unit.on('+relode:done', ({ id }) => {
    const position = xthree.coord2dTo3d(object.x, object.y + offset);
    model = xnew(Model, { position, id, scale: 0.5 });
  });
  unit.on('+drop', () => {
    if (model !== null) {
      xnew.context(xbasics.Scene).add(ModelBall, { x: object.x, y: object.y + offset, id: model.id });
      model.finalize();
      model = null;
      xnew.emit('+reload');
    } 
  });
  unit.on('update', () => {
    object.rotation += 0.02;
    const position = xthree.coord2dTo3d(object.x, object.y + offset);
    model?.threeObject.position.set(position.x, position.y, position.z);
  });
}

let prev = 0;
function ModelBall(ball, { x, y, id = 0 }) {
  const scale = [0.7, 1.0, 1.3, 1.4, 1.6, 1.8, 1.9, 1.9, 1.9][id];
  const radius = 35 + Math.pow(3.0, scale * 2.0);
  xnew.extend(Circle, { x, y, radius, color: 0, alpha: 0.0 });
  
  const now = new Date().getTime();
  if (now - prev > 200) {
    prev = now;
    const synth = xnew(xbasics.Synthesizer, { oscillator: { type: 'triangle', envelope: { amount: 8, ADSR: [0, 500, 1, 0], }, }, filter: { type: 'bandpass', cutoff: 1000}, amp: { envelope: { amount: 1, ADSR: [20, 100, 0, 0], }, }, reverb: { time: 1000, mix: 0.2, },  });
    synth.press(['C5', 'D5', 'E5', 'F5', 'G5', 'A5', 'B5', 'C6'][id], 100);
  }

  const model = xnew(Model, { id, scale });
  xnew.emit('+scoreup', { score: id });

  xnew.context(xbasics.Scene).add(StarParticles, { x, y });
  
  ball.on('update', () => {
    const position = xthree.coord2dTo3d(ball.pixiObject.x, ball.pixiObject.y);
    model.threeObject.position.set(position.x, position.y, position.z);
    model.threeObject.rotation.z = -ball.pixiObject.rotation;
    if (ball.pixiObject.y > xpixi.canvas.height) {
      xnew.emit('+gameover');
      ball.finalize();
      return;
    }

    // merge check
    for (const target of xnew.find(ModelBall).filter((target) => target !== ball && target.id === ball.id && target.id < 7)) {
      const [a, b] = [ball.pixiObject, target.pixiObject];
      const dist = Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y));

      if (dist < ball.radius + target.radius + 0.01) {
        xnew.context(xbasics.Scene).add(ModelBall, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, id: id + 1 });
        ball.finalize();
        target.finalize();
        break;
      }
    }
  });
  return {
    get radius() { return radius; },
    get id() { return id; },
  }
}

function StarParticles(unit, { x, y }) {
  const container = xpixi.nest(new PIXI.Container({ position: { x, y } }));

  for (let i = 0; i < 5; i++) {
    const size = 12 + Math.random() * 20;
    // yellow, gold, orange, white, pink, sky blue, light green, light pink
    const color = [0xFFFF00, 0xFFD700, 0xFFA500, 0xFFFFFF, 0xFF69B4, 0x87CEEB, 0x98FB98, 0xFFB6C1][Math.floor(Math.random() * 8)];

    const graphics = new PIXI.Graphics().star(0, 0, 5, size, size * 0.5).fill(color);
    container.addChild(graphics);

    const angle = (Math.PI * 2 / 5) * i + Math.random() * 0.5;
    const speed = 1 + Math.random() * 1.5;
    let [vx, vy, va] = [Math.cos(angle) * speed, Math.sin(angle) * speed, Math.random() * 0.3 - 0.15];

    const distance = 20 + Math.random() * 15; 
    graphics.x = Math.cos(angle) * distance;
    graphics.y = Math.sin(angle) * distance;

    xnew.transition(({ value }) => {
      vy += 0.2; // gravity
      graphics.x += vx;
      graphics.y += vy;
      graphics.rotation += va;
      graphics.alpha = 1 - value;
    }, 1600);
  }
  xnew.timeout(() => unit.finalize(), 1200);
}

function Circle(unit, { x, y, radius, color = 0xFFFFFF, alpha = 1.0, options = {} }) {
  const object = xpixi.nest(new PIXI.Container({ position: { x, y } }));
  const pyshics = Matter.Bodies.circle(x, y, radius, options);
  Matter.Composite.add(xmatter.world, pyshics);
  unit.on('finalize', () => Matter.Composite.remove(xmatter.world, pyshics));

  const graphics = new PIXI.Graphics().circle(0, 0, radius).fill(color);
  object.addChild(graphics);
  object.alpha = alpha;

  unit.on('update', () => {
    object.rotation = pyshics.angle;
    object.position.set(pyshics.position.x, pyshics.position.y);
  });
}

// ---- UI parts (title / result / volume) ----

// 丸枠アイコン: 外周の円 + 中央70%に xicons のアイコン。Camera / ArrowUturnLeft で共有。
function RingIcon(unit, { icon }) {
  xnew('<div style="position: absolute; inset: 0; margin: auto; width: 100%; height: 100%;">', () => {
    xnew.extend(xbasics.SVG, { viewBox: '0 0 24 24', style: 'display: block; width: 100%; height: 100%; stroke: currentColor;' });
    xnew('<circle cx="12" cy="12" r="11">');
  });
  xnew('<div style="position: absolute; inset: 0; margin: auto; width: 70%; height: 70%;">', () => {
    xnew(icon, { style: 'display: block; width: 100%; height: 100%;' });
  });
}

function Camera(_unit) {
  xnew.extend(RingIcon, { icon: xicons.Camera });
}

function ArrowUturnLeft(_unit) {
  xnew.extend(RingIcon, { icon: xicons.ArrowUturnLeft });
}

// 生成時に渡された要素を白で覆ってからフェードアウトしつつ撮影し、PNG をダウンロードする。
function ScreenShot(unit) {
  const cover = xnew('<div class="absolute inset-0 size-full z-10 bg-white">');
  xnew.transition(({ value }) => cover.element.style.opacity = 1 - value, 1000)
    .timeout(() => {
      html2canvas(unit.element, { scale: 2, logging: false, useCORS: true }).then((canvas) => {
        // 下部 13% のフッターを除いた領域を切り出して PNG としてダウンロードする。
        const [width, height] = [canvas.width, Math.floor(canvas.height * 0.87)];
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

// リザルトのフッター。「画面を保存」(ScreenShot) と「戻る」(onBack) の2ボタン。
function ResultFooter(unit, { onBack }) {
  xnew.nest('<div class="absolute bottom-0 w-full h-[13cqh] px-[2cqw] flex justify-between text-stone-500">');
  xnew('<div class="flex items-center gap-x-[2cqw]">', () => {
    const button = xnew('<div class="relative size-[9cqw] cursor-pointer hover:scale-110">', Camera);
    button.on('click', () => xnew(document.querySelector('#main'), ScreenShot));
    xnew('<div class="text-[3cqw] font-bold">', '画面を保存');
  });

  xnew('<div class="flex items-center gap-x-[2cqw]">', () => {
    xnew('<div class="text-[3cqw] font-bold">', '戻る');
    const button = xnew('<div class="relative size-[9cqw] cursor-pointer hover:scale-110">', ArrowUturnLeft);
    button.on('click', () => onBack());
  });
}

// リザルト背景：斜めグラデ + 大きな "Result" + 漂う/瞬く白丸。
// gradient="from-... to-..."（bg-linear-to-br 用）/ textColor="text-..."。
function ResultBackground(unit, { gradient, textColor }) {
  xnew.nest(`<div class="relative size-full bg-linear-to-br ${gradient}">`);
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
  xnew(xbasics.SVGText, { text, fontSize: '10cqw', style: 'stroke: #EEEEEE; stroke-width: 0.2cqw;', className: 'inline-block' });
}

// 点滅する "touch start"。color="text-..."。
function TouchMessage(unit, { color }) {
  xnew.nest(`<div class="absolute w-full top-[30cqw] text-center ${color} font-bold">`);
  xnew(xbasics.SVGText, { text: 'touch start', fontSize: '6cqw', style: 'stroke: #EEEEEE; stroke-width: 0.2cqw;', className: 'inline-block' });
  unit.on('update', ({ count }) => unit.element.style.opacity = 0.6 + Math.sin(count * 0.08) * 0.4);
}

// 中央に降りてくる "Game Over"。className で横位置を調整（既定は全幅中央）。
function GameOverText(unit, { className = 'w-full' }) {
  xnew.nest(`<div class="absolute ${className} text-center text-red-400 font-bold">`);
  xnew(xbasics.SVGText, { text: 'Game Over', fontSize: '12cqw', style: 'stroke: #EEEEEE; stroke-width: 0.2cqw;', className: 'inline-block' });
  xnew.transition(({ value }) => {
    Object.assign(unit.element.style, { opacity: value, top: `${10 + value * 15}cqw` });
  }, 1000, 'ease');
}

// スピーカーアイコン（muted で消音グリフに切り替わる）。
function SpeakerIcon(unit, { muted = false } = {}) {
  xnew.extend(muted ? xicons.SpeakerXMark : xicons.SpeakerWave, { style: 'display: block; width: 100%; height: 100%;' });
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
    const sizeProp = isHoriz ? 'width' : 'height';

    const outerSize = isHoriz ? `top: 20%; bottom: 20%; width: 0${cqUnit}` : `left: 20%; right: 20%; height: 0${cqUnit}`;
    const outer = xnew.nest(`<div style="position: absolute; ${outerSize};">`);

    // スライダー本体は xbasics.InputRange(トラック枠線 + フィルバー + 隠しネイティブ input)
    // AudioParam は float32 なので読み返しに誤差が乗る。丸めて整数にする
    xnew(xbasics.InputRange, { value: Math.round(volume.volume * 100) })
      .on('input', ({ value }) => {
        volume.volume = value / 100;
        button.update();
      });

    system.on('-transition', ({ value }) => {
      outer.style[anchor] = `-${value * 400 + 20}${cqUnit}`;
      outer.style[sizeProp] = `${value * 400}${cqUnit}`;
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

