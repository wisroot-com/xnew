import { xnew, xbasics } from '@mulsense/xnew';
import { xthree } from '@mulsense/xnew/addons/xthree';
import * as THREE from 'three';

xnew(document.querySelector('#main'), Main);

function Main(unit) {
  const [width, height] = [800, 600];
  xnew.extend(xbasics.Screen, { width, height });

  // three setup
  xthree.initialize({ canvas: unit.canvas });
  xthree.camera.position.set(0, 0, +100);
  xthree.scene.fog = new THREE.Fog(0xa0a0a0, 10, 300);

  xnew.promise(unit).then(() => {
    unit.on('update', () => {
      xthree.renderer.render(xthree.scene, xthree.camera);
    });

    xnew(Contents);
  });
}

function Contents(unit) {
  xnew(DirectionalLight);
  xnew.interval(() => xnew(Cube), 50);
}

function DirectionalLight(unit) {
  const object = xthree.nest(new THREE.DirectionalLight(0xFFFFFF, 1));
  object.position.set(0, 0, 1);
}

function Cube(unit) {
  const size = 10 * Math.random() + 5;

  const geometry = new THREE.BoxGeometry(size, size, size);
  const material = new THREE.MeshLambertMaterial({ color: 0xFFFFFF * Math.random() });
  const object = xthree.nest(new THREE.Mesh(geometry, material));

  object.position.x = 100 * (Math.random() - 0.5);
  object.position.y = 100 * (Math.random() - 0.5);
  object.position.z = 100 * (Math.random() - 0.5);

  const velocity = {};
  velocity.x = Math.random() - 0.5;
  velocity.y = Math.random() - 0.5;
  velocity.z = Math.random() - 0.5;

  // finalize after 5000ms
  xnew.timeout(() => unit.finalize(), 5000);

  unit.on('update', () => {
    object.position.x += velocity.x;
    object.position.y += velocity.y;
    object.position.z += velocity.z;
    object.rotation.y += 0.01;
    object.rotation.x += 0.01;
  })
}