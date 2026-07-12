import { xnew, xbasics } from '@mulsense/xnew';
import { xthree } from '@mulsense/xnew/addons/xthree';
import * as THREE from 'three';

xnew(document.querySelector('#main'), Main);

function Main(unit) {
  const [width, height] = [800, 600];
  xnew.extend(xbasics.Screen, { width, height });

  // three setup
  xthree.initialize({ canvas: unit.canvas });
  xthree.camera.position.set(0, -20, +20);
  xthree.camera.lookAt(0, 0, 0);
  xthree.renderer.shadowMap.enabled = true;

  xnew.promise(unit).then(() => {
    unit.on('update', () => {
      xthree.renderer.render(xthree.scene, xthree.camera);
    });

    xnew(Contents);
  });
}

function Contents(unit) {
  // gui
  xnew(Controller);

  // lights
  xnew(DirectionaLight, { position: { x: 20, y: -50, z: 100 } });
  xnew(AmbientLight);

  // objects
  xnew(Ground, { size: 100, color: 0xf8f8ff });
  xnew(Dorm, { size: 50 });
  xnew(Cube, { x: 0, y: 0, z: 2, size: 4, color: 0xaaaaff });
}

function DirectionaLight(unit, { color = 0xffffff, intensity = 1.0, position }) {
  const object = xthree.nest(new THREE.DirectionalLight(color, intensity));
  object.position.set(position.x, position.y, position.z);
  object.castShadow = true;
}

function AmbientLight(unit, { color = 0xffffff, intensity = 1.0 }) {
  const object = xthree.nest(new THREE.AmbientLight(color, intensity));
}

function Dorm(unit, { size }) {
  const geometry = new THREE.SphereGeometry(size, 25, 25);
  const material = new THREE.MeshBasicMaterial({ color: 0xEEEEFF, side: THREE.BackSide });
  const object = xthree.nest(new THREE.Mesh(geometry, material));
}

function Ground(unit, { size, color }) {
  const geometry = new THREE.PlaneGeometry(size, size, 1, 1);
  const material = new THREE.MeshStandardMaterial({ color, transparent: true, });
  const object = xthree.nest(new THREE.Mesh(geometry, material));
  object.receiveShadow = true;
}

function Cube(unit, { x, y, z, size, color }) {
  const geometry = new THREE.BoxGeometry(size, size, size);
  const material = new THREE.MeshLambertMaterial({ color, });
  const object = xthree.nest(new THREE.Mesh(geometry, material));
  object.position.set(x, y, z);
  object.castShadow = true;
}

function Controller(unit) {
  const object = xthree.nest(new THREE.Object3D());
  const pivot1 = new THREE.Object3D();
  const pivot2 = new THREE.Object3D();
  object.add(pivot1);
  pivot1.add(pivot2);
  pivot2.add(xthree.camera);
  pivot1.position.set(0, 0, 0);
  pivot2.position.set(0, 0, 0);

  // reusable vectors for screen-based panning
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  const forward = new THREE.Vector3();

  unit.on('touchstart contextmenu wheel', ({ event }) => event.preventDefault());

  unit.on('dragmove', ({ event, delta }) => {
    if (event.buttons & 1 || !event.buttons) {
      // rotate
      pivot2.rotation.x -= delta.y * 0.01;
      pivot1.rotation.z -= delta.x * 0.01;
    } else if (event.buttons & 2) {
      // translate (pan along the screen plane, using the camera's world axes)
      xthree.camera.updateWorldMatrix(true, false);
      xthree.camera.matrixWorld.extractBasis(right, up, forward);

      const distance = xthree.camera.position.length();
      const factor = (distance / xthree.camera.zoom) * 0.001;
      object.position.addScaledVector(right, -delta.x * factor);
      object.position.addScaledVector(up, +delta.y * factor);
    }
  });
  unit.on('wheel', ({ event, delta }) => {
    // scale (zoom without moving the camera)
    xthree.camera.zoom *= 1 + 0.001 * delta.y;
    xthree.camera.updateProjectionMatrix();
  });
}
