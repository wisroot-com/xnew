import * as PIXI from 'pixi.js';
import { xnew, xbasics } from '@mulsense/xnew';
import { xpixi } from '@mulsense/xnew/addons/xpixi';

xnew(document.querySelector('#main'), Main);

function Main(unit) {
  const [width, height] = [800, 600];
  xnew.extend(xbasics.Screen, { width, height });

  // setup pixi
  xpixi.initialize({ canvas: unit.canvas });

  xnew.promise(unit).then(() => {
    unit.on('update', () => {
      xpixi.renderer.render(xpixi.scene);
    });

    xnew(Contents);
  });
}

function Contents(unit) {
  xnew(Background);
  
  xnew(TitleScene);
}

function Background(unit) {
  const object = xpixi.nest(new PIXI.Container());
  object.addChild(new PIXI.Graphics().rect(0, 0, xpixi.canvas.width, xpixi.canvas.height).fill(0x000000));

  for (let i = 0; i < 100; i++) {
    xnew(Dot);
  }
}

function Dot(unit) {
  const object = xpixi.nest(new PIXI.Container());
  object.position.set(Math.random() * xpixi.canvas.width, Math.random() * xpixi.canvas.height);
  object.addChild(new PIXI.Graphics().circle(0, 0, 1).fill(0xFFFFFF));

  let velocity = Math.random() + 0.1;
  unit.on('update', () => {
    object.y += velocity;
    if (object.y > xpixi.canvas.height) {
      object.position.set(Math.random() * xpixi.canvas.width, 0);
    }
  });
}

function TitleScene(unit) {
  xnew.extend(xbasics.Scene);

  xnew(TitleText);
  unit.on('window.keydown pointerdown', () => unit.change(GameScene));
}

function TitleText(unit) {
  const object = xpixi.nest(new PIXI.Text('touch start', { fontSize: 32, fill: 0xFFFFFF }));
  object.position.set(xpixi.canvas.width / 2, xpixi.canvas.height / 2);
  object.anchor.set(0.5);
}

function GameScene(unit) {
  xnew.extend(xbasics.Scene);

  xnew(Controller);
  xnew(ScoreText);
  xnew(Player);
  const interval = xnew.interval(() => xnew(Enemy), 500);

  unit.on('+gameover', () => {
    interval.clear();
    xnew(GameOverText);
    xnew.timeout(() => {
      unit.on('window.keydown pointerdown', () => unit.change(TitleScene));
    }, 1000);
  });
}

function Controller(unit) {
  // prevent default event
  unit.on('touchstart document.contextmenu window.keydown', ({ event }) => event.preventDefault());
  
  // left bottom
  xnew(() => {
    xnew.nest('<div class="absolute left-0 right-0 bottom-0 w-full h-[30%] pointer-events-none" style="container-type: size;">');
    xnew.nest('<div class="absolute left-0 top-0 bottom-0 w-[100cqh] h-full">');
    // directional pad
    const dpad = xnew('<div class="absolute inset-[5cqh]">', xbasics.VirtualPad, { type: '8way' });
    dpad.on('-down -move -up', ({ vector }) => xnew.emit('+move', { vector }));

    dpad.on('pointerdown', ({ event }) => {
      event.stopPropagation();
    });
  });

  unit.on('pointerdown', () => {
      xnew.emit('+shot')
  });

  unit.on('window.keydown.arrow window.keyup.arrow window.keydown.wasd window.keyup.wasd', ({ vector }) => xnew.emit('+move', { vector }));
  unit.on('window.keydown', ({ event }) => {
    if (event.code === 'Space') {
      xnew.emit('+shot')
    }
  });
}

function ScoreText(unit) {
  const object = xpixi.nest(new PIXI.Text('score 0', { fontSize: 32, fill: 0xFFFFFF }));
  object.position.set(xpixi.canvas.width - 10, 10); // top right
  object.anchor.set(1.0, 0.0);

  let sum = 0;
  unit.on('+scoreup', ({ score }) => object.text = `score ${sum += score}`);
}

function GameOverText(unit) {
  const object = xpixi.nest(new PIXI.Text('game over', { fontSize: 32, fill: 0xFFFFFF }));
  object.position.set(xpixi.canvas.width / 2, xpixi.canvas.height / 2);
  object.anchor.set(0.5);
}

function Player(unit) {
  const object = xpixi.nest(new PIXI.Container());
  object.position.set(xpixi.canvas.width / 2, xpixi.canvas.height / 2);
  xnew(Sprite, { rects: [[0, 0, 32, 32], [32, 0, 32, 32]] });

  // actions
  let velocity = { x: 0, y: 0 };
  unit.on('+move', ({ vector }) => velocity = vector);
  unit.on('+shot', () => xnew.context(xbasics.Scene).add(Shot, { x: object.x, y: object.y }));
  unit.on('+shot', () => unit.sound());

  unit.on('update', () => {
    object.x += velocity.x * 2;
    object.y += velocity.y * 2;

    // limitation (10 < x < width - 10, 10 < y < height - 10)
    object.x = Math.min(Math.max(object.x, 10), xpixi.canvas.width - 10);
    object.y = Math.min(Math.max(object.y, 10), xpixi.canvas.height - 10);

    // detect collision
    for (const enemy of xnew.find(Enemy)) {
      if (enemy.distance(object) < 30) {
        enemy.clash(1);
        xnew.emit('+gameover');
        unit.finalize();
        return;
      }
    }
  });
  return {
    sound() {
      const synth = xnew(xbasics.Synthesizer, {
        oscillator: { type: 'square', envelope: { amount: 36, ADSR: [0, 200, 0.2, 200], }, },
        amp: { envelope: { amount: 0.1, ADSR: [0, 100, 0.2, 200], },},
      });
      synth.press('E3', 200); 
    }
  };
}

function Shot(unit, { x, y }) {
  const object = xpixi.nest(new PIXI.Container());
  object.position.set(x, y);
  object.addChild(new PIXI.Graphics().ellipse(0, 0, 4, 24).fill(0x22FFFF));

  unit.on('update', () => {
    object.y -= 12;

    // finalize when out of screen
    if (object.y < 0) {
      unit.finalize();
      return;
    }
    
    // detect collision
    for (const enemy of xnew.find(Enemy)) {
      if (enemy.distance(object) < 30) {
        enemy.clash(1);
        unit.finalize();
        return;
      }
    }
  });
}

function Enemy(unit) {
  const object = xpixi.nest(new PIXI.Container());
  object.position.set(Math.random() * xpixi.canvas.width, 0);
  xnew(Sprite, { rects: [[0, 32, 32, 32], [32, 32, 32, 32], [64, 32, 32, 32]] });

  // set velocity and angle of the object
  const v = Math.random() * 2 + 1;
  const a = Math.random() * (Math.PI / 2) + Math.PI / 4;
  const velocity = { x: v * Math.cos(a), y: v * Math.sin(a)};
  
  unit.on('update', () => {
    // move in the opposite direction at the edge of the screen
    if (object.x < 10) velocity.x = +Math.abs(velocity.x);
    if (object.x > xpixi.canvas.width - 10) velocity.x = -Math.abs(velocity.x);
    if (object.y < 10) velocity.y = +Math.abs(velocity.y);
    if (object.y > xpixi.canvas.height - 10) velocity.y = -Math.abs(velocity.y);
    object.position.set(object.x + velocity.x, object.y + velocity.y);
  });

  return {
    clash(score) {
      unit.sound(score);
      for (let i = 0; i < 4; i++) {
        xnew.context(xbasics.Scene).add(Crash, { x: object.x, y: object.y, score });
      }
      xnew.context(xbasics.Scene).add(CrashText, { x: object.x, y: object.y, score });
      xnew.emit('+scoreup', { score });
      unit.finalize();
    },
    distance(target) {
      const dx = target.x - object.x;
      const dy = target.y - object.y;
      return Math.sqrt(dx * dx + dy * dy);
    },
    sound(score) {
      const v = Math.log2(score); // convert svore (1->0, 2->1, 4->2, 8->3, ...)
      const synth = xnew(xbasics.Synthesizer, {
        oscillator: { type: 'triangle', },
        amp: { envelope: { amount: 0.1, ADSR: [0, 200, 0.0, 0], }, },
      });
      synth.press(440 * Math.pow(2, (v * 2 + 0) / 12), 200, 0); 
      synth.press(440 * Math.pow(2, (v * 2 + 8) / 12), 200, 100); 
      synth.press(440 * Math.pow(2, (v * 2 + 12) / 12), 200, 200); 
    }
  };
}

function CrashText(unit, { x, y, score }) {
  const object = xpixi.nest(new PIXI.Text(`+ ${score}`, { fontSize: 24, fill: '#FFFF22' }));
  object.position.set(x, y);
  object.anchor.set(0.5);

  xnew.timeout(() => unit.finalize(), 1000); // remove after 1 second
  let count = 0;
  unit.on('update', () => { // bounding
    object.y = y - 50 * Math.exp(-count / 20) * Math.abs(Math.sin(Math.PI * (count * 10) / 180));
    count++;
  });
}

function Crash(unit, { x, y, score }) {
  const object = xpixi.nest(new PIXI.Container());
  object.position.set(x, y);
  xnew(Sprite, { rects: [[0, 64, 32, 32]] });

  const v = Math.random() * 4 + 1; // 1 ~ 5
  const a = Math.random() * 2 * Math.PI; // 0 ~ 2PI
  const velocity = { x: v * Math.cos(a), y: v * Math.sin(a)};

  xnew.timeout(() => unit.finalize(), 800); // remove after 800ms

  let count = 0;
  unit.on('update', () => {
    object.x += velocity.x;
    object.y += velocity.y;
    object.rotation = count / 10;
    object.alpha = 1 - count / 100; // fade out
    count++;

    // detect collision
    for (const enemy of xnew.find(Enemy)) {
      if (enemy.distance(object) < 30) {
        enemy.clash(score * 2);
        unit.finalize();
        return;
      }
    }
  });
}

function Sprite(unit, { rects }) {
  const object = xpixi.nest(new PIXI.Container());
  xnew.promise(PIXI.Assets.load('texture.png')).then((texture) => {
    texture.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
    const textures = rects.map((rect) => new PIXI.Texture({ source: texture, frame: new PIXI.Rectangle(...rect) }));
    const sprite = new PIXI.AnimatedSprite(textures);
    sprite.animationSpeed = 0.1;
    sprite.anchor.set(0.5);
    sprite.scale.set(2);
    sprite.play();
    object.addChild(sprite);
  });
}
