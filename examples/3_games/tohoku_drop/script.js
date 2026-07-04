import * as PIXI from 'pixi.js';
import Matter from 'matter-js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import voxelkit from 'voxelkit';
import { xnew, xbasics } from '@mulsense/xnew';
import { xpixi } from '@mulsense/xnew/addons/xpixi';
import { xthree } from '@mulsense/xnew/addons/xthree';
import { xmatter } from '@mulsense/xnew/addons/xmatter';
import { ResultBackground, ResultImage, ResultFooter, TitleText, TouchMessage, GameOverText, VolumeControl } from '../utils/ui.js';

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

  const texture = PIXI.Texture.from(xthree.canvas);
  unit.on('update', () => {
    xthree.renderer.render(xthree.scene, xthree.camera);
    texture.source.update();
    xpixi.renderer.render(xpixi.scene);
  });

  xnew(Contents);
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

  xnew(Background);
  xnew(ShadowPlane);
  xnew(DirectionalLight, { x: 2, y: 12, z: 20 });
  xnew(AmbientLight);

  for (let id = 0; id < 7; id++) {
    const position = convert3d(140 + id * 90, 450);
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
  
  xnew(Background);
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

  unit.on('+gameover', () => {
    unit.off('+gameover');
    playing.finalize();
    const image = xpixi.renderer.extract.base64({ target: xpixi.scene, frame: new PIXI.Rectangle(0, 0, xpixi.canvas.width, xpixi.canvas.height) });
    xnew(GameOverText);

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
  xnew(ResultImage, { image, boxClass: 'bottom-[12cqw] left-[2cqw] size-[45cqw]' });
  xnew(ResultDetail);
  xnew(ResultFooter, { onBack: () => unit.change(TitleScene) });
}

function Background(unit) {
  const object = xpixi.nest(new PIXI.Container());
  xnew.promise(PIXI.Assets.load('./background.jpg')).then((texture) => {
    const sprite = new PIXI.Sprite(texture);
    sprite.scale.set(xpixi.canvas.width / texture.frame.width, xpixi.canvas.height / texture.frame.height);
    object.addChild(sprite);
  });
}

function ThreeTexture(unit) {
  const texture = PIXI.Texture.from(xthree.canvas)
  const object = xpixi.nest(new PIXI.Sprite(texture));
}

function ScoreText(unit) {
  xnew.nest('<div class="absolute top-[1cqw] right-[2cqw] w-full text-right text-green-600 font-bold">');
  const text = xnew(xbasics.SVGText, { text: 'score 0', fontSize: '6cqw', stroke: '#EEEEEE', strokeWidth: '0.2cqw', className: 'inline-block' });
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

  const position = convert3d(10 + 70, 70);
  const rotation = { x: 30 / 180 * Math.PI, y: 60 / 180 * Math.PI, z: 0 };
  let model = xnew(Model, { position, rotation, id: balls[0], scale: 0.6 });

  unit.on('+reload', () => {
    const position = convert3d(10, 70);
    const rotation = { x: 30 / 180 * Math.PI, y: 60 / 180 * Math.PI, z: 0 };
    model.finalize();
    model = xnew(Model, { position, rotation, id: balls[1], scale: 0.6 });

    balls.push(Math.floor(Math.random() * 3));
    xnew.transition(({ value }) => {
      const position = convert3d(10 + value * 70, 70);
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
    const position = convert3d(object.x, object.y + offset);
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
    const position = convert3d(object.x, object.y + offset);
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
    const position = convert3d(ball.pixiObject.x, ball.pixiObject.y);
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

// helpers
function convert3d(x, y, z = 0) {
  return { x: (x - xpixi.canvas.width / 2) / 70, y: - (y - xpixi.canvas.height / 2) / 70, z: z };
}

