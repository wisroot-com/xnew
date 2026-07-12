import { xnew, xbasics } from '@mulsense/xnew';
import { xpixi } from '@mulsense/xnew/addons/xpixi';
import { xrapier2d } from '@mulsense/xnew/addons/xrapier2d';
import * as PIXI from 'pixi.js';
import RAPIER from '@dimforge/rapier2d-compat';

xnew(document.querySelector('#main'), Main);

function Main(unit) {
  xnew.extend(xbasics.Screen, { width: 800, height: 600 });

  // pixi setup
  xpixi.initialize({ canvas: unit.canvas });

  xnew.promise(unit).then(() => {
    unit.on('update', () => {
      xpixi.renderer.render(xpixi.scene);
    });

    xnew(Contents);
  });
}

function Contents(unit) {
  xnew.extend(xbasics.Scene);
  xrapier2d.initialize({ gravity: { x: 0.0, y: 9.81 * 10 } });

  xnew.promise(unit).then(() => {
    unit.on('update', () => {
      xrapier2d.world.timestep = 3 / 60;
      xrapier2d.world.step();
    });
    xnew(Rectangle, { x: 400, y: 200, w: 80, h: 80, color: 0x00FF00 });
    xnew(Rectangle, { x: 400, y: 400, w: 380, h: 40, color: 0xFFFF00 , dynamic: false });
  });

  const button = xnew('<button class="absolute top-0 h-8 m-2 px-2 border rounded-lg cursor-pointer hover:bg-gray-200">', 'reset');
  button.on('click', () => unit.change(Contents));
}

function Rectangle(self, { x, y, w, h, color = 0xFFFFFF, dynamic = true, options = {} }) {
  const object = xpixi.nest(new PIXI.Container());
  object.position.set(x, y);
  object.addChild(new PIXI.Graphics().rect(-w / 2, -h / 2, w, h).fill(color));

  // Create a dynamic rigid-body using xrapier2d
  const rigidBodyDesc = dynamic
    ? RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y)
    : RAPIER.RigidBodyDesc.fixed().setTranslation(x, y);
  const rigidBody = xrapier2d.world.createRigidBody(rigidBodyDesc);

  // Create a cuboid collider attached to the dynamic rigidBody
  const colliderDesc = RAPIER.ColliderDesc.cuboid(w / 2, h / 2);
  const collider = xrapier2d.world.createCollider(colliderDesc, rigidBody);
  self.on('finalize', () => {
    xrapier2d.world.removeCollider(collider);
    xrapier2d.world.removeRigidBody(rigidBody);
  });
  self.on('update', () => {
    const position = rigidBody.translation();
    object.position.set(position.x, position.y);
  });
}
