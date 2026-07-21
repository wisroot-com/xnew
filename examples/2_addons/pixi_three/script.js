import { xnew, xbasics } from '@mulsense/xnew';
import { xpixi } from '@mulsense/xnew/addons/xpixi';
import { xthree } from '@mulsense/xnew/addons/xthree';
import * as PIXI from 'pixi.js';
import * as THREE from 'three';

xnew(document.querySelector('#main'), Main);

function Main(unit) {
  const [width, height] = [800, 600];
  xnew.extend(xbasics.Screen, { width, height });

  // three setup
  xthree.initialize({ canvas: new OffscreenCanvas(width, height) });
  xthree.camera.position.set(0, 0, +100);

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
  // three.js (offscreen canvas)
  xnew(Cubes);

  // pixi.js (screen canvas)
  xnew(ThreeTexture); // render three.js canvas as pixi texture
  xnew(Boxes);
}

function ThreeTexture(unit) {
  const texture = PIXI.Texture.from(xthree.canvas)
  const object = xpixi.add(new PIXI.Sprite(texture));
}

function Boxes(unit) {
  const object = xpixi.nest();
  object.position.set(xpixi.canvas.width / 2, xpixi.canvas.height / 2); // center

  for (let y = -1; y <= 1; y++) {
    for (let x = -1; x <= 1; x++) {
        xnew(Box, { x: 120 * x, y: 120 * y, size: 60, color: 0xEA1E63 });
    }
  }
  unit.on('update', () => object.rotation += 0.01);
}

function Box(unit, { x, y, size, color }) {
  const object = xpixi.nest();
  object.position.set(x, y);
  object.addChild(new PIXI.Graphics().rect(-size / 2, -size / 2, size, size).fill(color));

  unit.on('update', () => object.rotation += 0.01);
}

function Cubes(unit) {
  const object = xthree.nest(new THREE.Object3D());

  for (let z = -1; z <= 1; z++) {
    for (let y = -1; y <= 1; y++) {
      for (let x = -1; x <= 1; x++) {
        xnew(Cube, { x: 15 * x, y: 15 * y, z: 15 * z, size: 6 });
      }
    }
  }
  unit.on('update', () => {
    object.rotation.y += 0.01;
    object.rotation.z += 0.01;
  });
}

function Cube(unit, { x, y, z, size }) {
  const geometry = new THREE.BoxGeometry(size, size, size);
  const material = new THREE.MeshNormalMaterial();
  const object = xthree.nest(new THREE.Mesh(geometry, material));
  object.position.set(x, y, z);

  unit.on('update', () => {
    object.rotation.x += 0.01;
    object.rotation.y += 0.01;
  });
}