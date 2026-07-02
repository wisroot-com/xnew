import { xnew } from '@mulsense/xnew';
import { xthree } from '@mulsense/xnew/addons/xthree';
import * as THREE from 'three';

xnew(document.querySelector('#main'), Main);

function Main(unit) {
  const [width, height] = [800, 600];
  xnew.extend(xnew.basics.Screen, { width, height });

  // three setup
  xthree.initialize({ canvas: unit.canvas });
  xthree.camera.position.set(0, 0, +100);

  unit.on('update', () => {
    xthree.renderer.render(xthree.scene, xthree.camera);
  });
  
  xnew(Contents);
}

function Contents(unit) {
  xnew(Cubes);
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

  unit.on('finalize', () => {
    geometry.dispose();
    material.dispose();
  });
}