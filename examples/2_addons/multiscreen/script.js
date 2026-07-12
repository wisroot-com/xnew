import { xnew, xbasics } from '@mulsense/xnew';
import { xpixi } from '@mulsense/xnew/addons/xpixi';
import * as PIXI from 'pixi.js';

xnew(document.querySelector('#main'), Main);

function Main(unit) {
  const [width, height] = [800, 600];
  xnew.extend(xbasics.Screen, { width, height });

  const canvas = xnew(`<canvas width="${width}" height="${height}" class="size-full align-bottom">`);

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
  const sub1 = xnew(SubScreen, { width: xpixi.canvas.width / 2, height: xpixi.canvas.height, color: 0xEA1E63 });
  const sub2 = xnew(SubScreen, { width: xpixi.canvas.width / 2, height: xpixi.canvas.height, color: 0x63EA1E });

  xnew(Texture, { texture: sub1.texture, offset: { x: 0, y: 0 } });
  xnew(Texture, { texture: sub2.texture, offset: { x: xpixi.canvas.width / 2, y: 0 } });
}

function SubScreen(unit, { width, height, color }) {
  xpixi.initialize({ canvas: new OffscreenCanvas(width, height) });
  const texture = PIXI.Texture.from(xpixi.canvas);

  xnew.promise(unit).then(() => {
    unit.on('update', () => {
      xpixi.renderer.render(xpixi.scene);
      texture.source.update();
    });

    xnew(Boxes, { color });
  });

  return {
    get texture() { return texture; }
  };
}

function Texture(unit, { texture, offset } = {}) {
  const object = xpixi.nest(new PIXI.Sprite(texture));
  object.position.set(offset.x, offset.y);
}

function Boxes(unit, { color }) {
  const object = xpixi.nest(new PIXI.Container());
  object.position.set(xpixi.canvas.width / 2, xpixi.canvas.height / 2); // center

  for (let y = -1; y <= 1; y++) {
    for (let x = -1; x <= 1; x++) {
      xnew(Box, { x: 120 * x, y: 120 * y, size: 60, color });
    }
  }
  unit.on('update', () => object.rotation += 0.01);
}

function Box(unit, { x, y, size, color }) {
  const object = xpixi.nest(new PIXI.Container());
  object.position.set(x, y);
  object.addChild(new PIXI.Graphics().rect(-size / 2, -size / 2, size, size).fill(color));

  unit.on('update', () => object.rotation += 0.01);
}