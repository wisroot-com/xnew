import { xnew, xbasics } from '@mulsense/xnew';
import { xpixi } from '@mulsense/xnew/addons/xpixi';
import { xthree } from '@mulsense/xnew/addons/xthree';
import * as PIXI from 'pixi.js';
import * as THREE from 'three';
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";

xnew(document.querySelector('#main'), Main);

function Main(unit) {
  const [width, height] = [800, 600];
  xnew.extend(xbasics.Screen, { width, height });

  // three setup
  const camera = new THREE.OrthographicCamera(-10, +10, +10, -10, 0, 100);
  xthree.init({ camera, canvas: new OffscreenCanvas(width, height) });
  xthree.camera.position.set(0, 0, +100);

  // pixi setup
  xpixi.init({ canvas: unit.canvas });

  xnew.promise(unit).then(() => {
    unit.on('update', () => {
      xthree.renderer.render(xthree.scene, xthree.camera);
    });

    unit.on('update', () => {
      xnew.emit('+prerender');
      xpixi.renderer.render(xpixi.scene);
    });

    xnew(Contents);
  });
}

function Contents(unit) {
  xnew(HtmlText);

  xnew(SVGText);

  // three.js (offscreen canvas)
  xnew(ThreeText);

  // pixi.js (screen canvas)
  xnew(CanvasTransfer); // three.js -> pixi.js
  xnew(PixiText);
}

function CanvasTransfer(unit) {
  const texture = PIXI.Texture.from(xthree.canvas);
  const object = xpixi.add(new PIXI.Sprite(texture));

  unit.on('+prerender', () => {
    texture.source.update();
  });
}

function HtmlText(unit) {
  xnew.nest('<div class="absolute left-0 top-0 text-[4cqw] text-red-400 font-bold">');
  unit.current.textContent = 'This text is rendered by HTML/CSS';
}

function SVGText(unit) {
  xnew(xbasics.SVGText, {
    className: 'absolute left-0 top-[10cqw]',
    text: 'This text is rendered by SVG',
    style: 'stroke: #00FF00; stroke-width: 0.5cqw;',
    fontSize: '4cqw',
  });
}

function PixiText(unit) {
  const object = xpixi.add(new PIXI.Text('This text is rendered by PixiJS', { fontFamily: 'Arial', fontSize: 32, }));
  object.anchor.set(0.0, 0.5);
  object.position.set(0.0, xpixi.canvas.height * 3 / 10);
}

function ThreeText(unit) {
  const object = xthree.nest();

  const loader = new FontLoader();
  xnew.promise(new Promise((resolve) => {
    loader.load('https://cdn.jsdelivr.net/npm/three@0.176.0/examples/fonts/helvetiker_regular.typeface.json',
      (font) => resolve(font));
  })).then((font) => {

    const geometry = new TextGeometry('This text is rendered by Three.js', {
      font,
      size: 1,
      depth: 0.5,
    });
    const material = new THREE.MeshNormalMaterial();
    const text = new THREE.Mesh(geometry, material);
    text.position.set(-17, 0, 0);
    object.add(text);
    object.rotation.set(0.2, 0.2, 0);
    object.scale.set(0.6, 1, 1);
  });
}

