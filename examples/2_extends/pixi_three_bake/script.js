import { xnew } from '@mulsense/xnew';
import { xpixi } from '@mulsense/xnew/addons/xpixi';
import { xthree } from '@mulsense/xnew/addons/xthree';
import * as PIXI from 'pixi.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin } from '@pixiv/three-vrm';

// const CHARACTER_FILES = ['zundamon.vrm', 'kiritan.vrm', 'zunko.vrm', 'itako.vrm'];
const CHARACTER_FILES = ['zunko.vrm'];

xnew(document.querySelector('#main'), Main);

function Main(unit) {
  const [width, height] = [800, 600];
  xnew.extend(xnew.basics.Screen, { width, height });

  xpixi.initialize({ canvas: unit.canvas });
  unit.on('update', () => xpixi.renderer.render(xpixi.scene));

  xnew(Contents);
}

function Contents(unit) {
  const assets = xnew(BakedCharacters);

  // 集約結果 { list: [{ textures }, ...] } から各キャラの textures だけ取り出して渡す。
  xnew.promise(assets).then(({ list }) => {
    xnew(ViewScene, { texturesList: list.map((result) => result.textures) });
  });
}

function BakedCharacters(unit) {
  // 登録順に list[] へ集約する（PreRender ごとの結果 { textures } が list に並ぶ）。
  for (const name of CHARACTER_FILES) {
    xnew.promise('list[]', xnew(PreRender, { url: `../../assets/${name}` }));
  }
}

function PreRender(unit, { url }) {
  const camera = new THREE.OrthographicCamera(-1, +1, +1, -1, 0.1, 10);
  xthree.initialize({ camera, canvas: new OffscreenCanvas(128, 128) });
  xthree.camera.position.set(0, -0.1, 2.5);

  xnew(() => {
    xthree.nest(new THREE.AmbientLight(0xFFFFFF, 1.2));
  });
  // xnew(() => {
  //   const dirLight = xthree.nest(new THREE.DirectionalLight(0xFFFFFF, 1.7));
  //   dirLight.position.set(2, 5, 10);
  // });

  const model = xnew(Model, { url });
  const textures = [];

  let resolve;
  xnew.promise('textures', (res) => { resolve = res; });

  const BAKE_FRAMES = 120;

  // Model のロード完了を待ってから、xnew.chunk で BAKE_FRAMES 回を時間予算（既定 8ms/フレーム）で
  // 自動的にフレーム分散してベイクする。完了で textures を解決し unit を畳む。
  // （旧実装の unit.on('update') + frameIndex/batch による手動バッチを置き換え。）
  xnew.promise(model).then(() => xnew.chunk(({ index }) => {
    const t = index * (Math.PI / BAKE_FRAMES * 3);

    model.threeObject.rotation.y = t * 4 / 3;
    model.threeObject.rotation.z = t * 2 / 3;
    const g = (name) => model.vrm.humanoid.getNormalizedBoneNode(name);
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
    model.vrm.update(t);

    xthree.renderer.render(xthree.scene, xthree.camera);
    textures.push(PIXI.Texture.from(xthree.canvas.transferToImageBitmap()));
  }, BAKE_FRAMES).then(() => {
    resolve(textures);
    unit.finalize();
  }));
}

function Model(unit, { url }) {
  const object = xthree.nest(new THREE.Object3D());
  let resolve;
  xnew.promise((res) => { resolve = res; });

  let vrm = null;
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));
  loader.load(url, (gltf) => {
    vrm = gltf.userData.vrm;
    vrm.scene.scale.set(0.7, 0.7, 0.7);
    vrm.scene.position.y = -0.7;
    vrm.scene.rotation.x = +Math.PI * 20 / 180;
    object.add(vrm.scene);
    resolve();
  });
  return {
    get vrm() { return vrm; },
  }
}

function ViewScene(unit, { texturesList }) {
  const cols = 4;
  const rows = 1;
  const cellW = 800 / cols;
  const cellH = 600 / rows;

  texturesList.forEach((textures, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = cellW * (col + 0.5);
    const y = cellH * row + cellH * 0.4;

    xnew(() => {
      const sprite = xpixi.nest(new PIXI.AnimatedSprite(textures));
      sprite.position.set(x, y);
      sprite.anchor.set(0.5);
      sprite.scale.set(1.5);
      sprite.play();
    });
  });
}
