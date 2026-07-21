import { xnew, xbasics } from '@mulsense/xnew';
import { xpixi } from '@mulsense/xnew/addons/xpixi';
import * as PIXI from 'pixi.js';

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
  xnew(Boxes);
}

function Boxes(unit) {
  const object = xpixi.nest({ position: { x: xpixi.canvas.width / 2, y: xpixi.canvas.height / 2 } }); // center

  for (let y = -1; y <= 1; y++) {
    for (let x = -1; x <= 1; x++) {
      xnew(Box, { x: 120 * x, y: 120 * y, size: 60, color: 0xEA1E63 });
    }
  }

  unit.on('update', () => {
    object.rotation += 0.01;
  });
}

function Box(unit, { x, y, size, color }) {
  const object = xpixi.nest({ position: { x, y } });
  object.addChild(new PIXI.Graphics().rect(-size / 2, -size / 2, size, size).fill(color));

  unit.on('update', () => {
    object.rotation += 0.01;
  });
}