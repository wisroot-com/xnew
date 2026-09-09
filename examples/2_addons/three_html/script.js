import { xnew, xbasics } from '@mulsense/xnew';
import { xthree } from '@mulsense/xnew/addons/xthree';
import * as THREE from 'three';

const perspective = 500;
const offset = { rx: 0, ry: 11, rz: 0, tx: 120, ty: 0, tz: 0 };
const transform = { rx: 0, ry: 0, rz: 0, tx: 0, ty: 0, tz: 0 };
const state = { id: 0, moving: false };

xnew(Main);

function Main(unit) {
  xnew(document.querySelector('#screen'), ThreeMain);
  xnew(Event);
}

function ThreeMain(unit) {
  const [width, height] = [1200, 800];
  xnew.extend(xbasics.Screen, { width, height, fit: 'cover' });

  xthree.init({ canvas: unit.canvas });

  // 部屋の壁までの距離を perspective に合わせておくと、Plane が出す視点までの距離もちょうど perspective になる
  unit.on('resize', () => {
    xthree.camera.fov = Math.atan2(unit.current.getBoundingClientRect().height / 2, perspective) * 2 * 180 / Math.PI;
    xthree.camera.updateProjectionMatrix();
  });

  xnew.promise(unit).then(() => {
    unit.on('update', () => {
      xthree.renderer.render(xthree.scene, xthree.camera);
    });

    // 板は自分より前に更新された値を見るので、視点を動かす View を板より先の子にしておく
    xnew(View);
    xnew(ThreeContents);
    xnew(HtmlCards);
  });
}

function View(unit) {
  unit.on('update', () => {
    xthree.scene.rotation.x = -(transform.rx + offset.rx) * Math.PI / 180;
    xthree.scene.rotation.y = +(transform.ry + offset.ry) * Math.PI / 180;
    xthree.camera.position.x = -(transform.tx + offset.tx);
    xthree.camera.position.y = +(transform.ty + offset.ty);
  });
}

// 板を置く箱は canvas の箱ではない（Screen の fit が cover で canvas が画面からはみ出す）ので、枠として canvas を渡す
function HtmlCards(unit) {
  const targets = xnew(document.querySelector('#targets'));
  targets.current.style.display = 'block';

  targets.current.querySelectorAll('.card').forEach((element, index) => {
    xnew(targets, Card, { element, id: index });
  });
}

function Card(unit, { element, id }) {
  // 板の置き場。壁ごとに 90 度ずつ回して、部屋の中心から壁まで離す
  const object = xthree.add(new THREE.Object3D());
  object.rotation.y = id * Math.PI / 2;
  object.translateZ(-perspective);

  xnew.extend(xthree.Plane, { object: () => object, frame: xthree.canvas, className: 'plane' });
  unit.current.appendChild(element);

  let opacity = id === state.id ? 0.80 : 0.20;
  unit.on('+cardfade', () => {
    xnew.transition(({ value }) => {
      opacity = id === state.id ? Math.max(opacity, 0.20 + value * 0.60) : Math.min(opacity, 0.80 - value * 0.60);
    }, 700);
  });

  unit.on('update', () => {
    unit.current.style.opacity = opacity;
  });
}

function Event(unit) {
  xnew(document.querySelector('.button.left'), Button, { direction: +1 });
  xnew(document.querySelector('.button.right'), Button, { direction: -1 });

  function Button(unit, { direction }) {
    unit.on('click', () => {
      if (state.moving === false) {
        state.id = (state.id + direction + 4) % 4;
        state.moving = true;
        const backup = { ...transform };
        xnew.transition(({ value }) => {
          const p = (1.0 - Math.cos(value * Math.PI)) * 0.5;
          transform.ry = backup.ry - direction * 90 * p;
          transform.ty = backup.ty * (1.0 - p);
          if (value === 1.0) state.moving = false;
        }, 700);
        xnew.emit('+cardfade');
      }
    });
  }

  unit.on('wheel', ({ event, delta }) => {
    event.preventDefault();
    transform.ty = Math.max(-300, Math.min(+300, transform.ty + delta.y * 0.2));
  }, { passive: false });
}

function ThreeContents(unit) {
  xnew(DirectionalLight, { intensity: 0.1, position: { x: 20, y: -50, z: 50 } });
  xnew(DirectionalLight, { intensity: 0.1, position: { x: 20, y: 50, z: -10 } });
  xnew(AmbientLight, { intensity: 0.05 });
  xnew(Room);
}

function DirectionalLight(unit, { color = 0xFFFFFF, intensity, position }) {
  const object = xthree.add(new THREE.DirectionalLight(color, intensity));
  object.position.set(position.x, position.y, position.z);
}

function AmbientLight(unit, { color = 0xFFFFFF, intensity }) {
  const object = xthree.add(new THREE.AmbientLight(color, intensity));
}

function Room(unit) {
  const size = perspective;
  const geometry = new THREE.BoxGeometry(size * 2, size * 2, size * 2);
  const material = new THREE.MeshStandardMaterial({
    color: 0xF8F8FF, side: THREE.BackSide,
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1
  });
  const object = xthree.add(new THREE.Mesh(geometry, material));

  xnew(Grid, { tz: +size, rx: 90 });
  xnew(Grid, { tz: -size, rx: 90 });
  xnew(Grid, { tx: +size, rz: 90 });
  xnew(Grid, { tx: -size, rz: 90 });
  xnew(Grid, { ty: +size });
  xnew(Grid, { ty: -size });
}

function Grid(unit, { tx = 0, ty = 0, tz = 0, rx = 0, ry = 0, rz = 0 }) {
  const object = xthree.add(new THREE.GridHelper(1100, 10, 0x444466, 0x444466));
  object.rotation.set(rx * Math.PI / 180, ry * Math.PI / 180, rz * Math.PI / 180);
  object.position.set(tx, ty, tz);
}
