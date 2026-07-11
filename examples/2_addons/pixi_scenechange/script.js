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
  xnew(Scene1);
}

function Scene1(unit) {
  xnew.extend(xbasics.Scene);
  
  xnew(Text, { text: 'Scene1' });
  xnew(Box, { x: xpixi.canvas.width / 2, y: xpixi.canvas.height / 2, size: 160, color: 0xff2266 });

  unit.on('pointerdown', ({ event }) => unit.change(Scene2));
}

function Scene2(unit) {
  xnew.extend(xbasics.Scene);
  
  xnew(Text, { text: 'Scene2' });
  xnew(Box, { x: xpixi.canvas.width / 2, y: xpixi.canvas.height / 2, size: 160, color: 0x6622ff });

  unit.on('pointerdown', ({ event }) => unit.change(Scene1));
}

function Text(unit, { text }) {
  const object = xpixi.nest(new PIXI.Text(text, { fontSize: 24, fill: 0x000000 }));
  object.position.set(10, 10);
}

function Box(unit, { x, y, size, color }) {
  const object = xpixi.nest(new PIXI.Container());
  object.position.set(x, y);
  object.addChild(new PIXI.Graphics().rect(-size / 2, -size / 2, size, size).fill(color));
  
  unit.on('update', () => {
    object.rotation += 0.01;
  });
}