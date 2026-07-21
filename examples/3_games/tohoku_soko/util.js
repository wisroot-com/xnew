
import * as PIXI from 'pixi.js';
import { xnew } from '@mulsense/xnew';
import { xpixi } from '@mulsense/xnew/addons/xpixi';

export function Background(unit) {
  xnew(() => {
    const object = xpixi.nest();
    xnew.promise(PIXI.Assets.load('./background.png')).then((texture) => {
      const sprite = new PIXI.Sprite(texture);
      sprite.scale.set(xpixi.canvas.width / texture.frame.width, xpixi.canvas.height / texture.frame.height);
      object.addChild(sprite);
    });
  })

  const container = xpixi.nest();
  const particles = [];
  const particleCount = 30;

  // グラデーションテクスチャを作成する関数
  function createGradientTexture(radius, baseAlpha) {
    const canvas = document.createElement('canvas');
    const size = radius * 2;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const gradient = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
    gradient.addColorStop(0, `rgba(255, 255, 255, ${baseAlpha})`);
    gradient.addColorStop(0.5, `rgba(255, 255, 255, ${baseAlpha * 0.5})`);
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    return PIXI.Texture.from(canvas);
  }

  // 霞のパーティクル生成
  for (let i = 0; i < particleCount; i++) {
    const radius = 60 + Math.random() * 120;
    const baseAlpha = 0.05 + Math.random() * 0.15;
    const texture = createGradientTexture(radius, baseAlpha);

    const sprite = new PIXI.Sprite(texture);
    sprite.anchor.set(0.5);
    sprite.x = Math.random() * xpixi.canvas.width;
    sprite.y = Math.random() * xpixi.canvas.height;

    const particle = {
      sprite,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      phase: Math.random() * Math.PI * 2,
      speed: 0.01 + Math.random() * 0.02
    };

    particles.push(particle);
    container.addChild(sprite);
  }

  // 細かいチリのパーティクル生成
  const dustParticles = [];
  const dustCount = 80;

  for (let i = 0; i < dustCount; i++) {
    const graphics = new PIXI.Graphics();
    const radius = 1 + Math.random() * 1;

    graphics.beginPath();
    graphics.circle(0, 0, radius);
    graphics.fill({ color: 0xFFFFFF, alpha: 0.3 + Math.random() * 0.4 });

    graphics.x = Math.random() * xpixi.canvas.width;
    graphics.y = Math.random() * xpixi.canvas.height;

    const dust = {
      graphics,
      vx: (Math.random() - 0.5) * 0.5,
      vy: -0.2 - Math.random() * 0.5, // 上方向に浮遊
      phase: Math.random() * Math.PI * 2,
      speed: 0.02 + Math.random() * 0.03,
      wobbleStrength: 0.3 + Math.random() * 0.5
    };

    dustParticles.push(dust);
    container.addChild(graphics);
  }

  let count = 0;
  unit.on('update', () => {
    count++;

    // 霞の更新
    particles.forEach(particle => {
      // 波のような動き
      particle.sprite.x += particle.vx + Math.sin(count * particle.speed + particle.phase) * 0.2;
      particle.sprite.y += particle.vy + Math.cos(count * particle.speed + particle.phase) * 0.2;

      // 画面端で折り返し
      if (particle.sprite.x < -100) particle.sprite.x = xpixi.canvas.width + 100;
      if (particle.sprite.x > xpixi.canvas.width + 100) particle.sprite.x = -100;
      if (particle.sprite.y < -100) particle.sprite.y = xpixi.canvas.height + 100;
      if (particle.sprite.y > xpixi.canvas.height + 100) particle.sprite.y = -100;

      // 透明度の変化
      particle.sprite.alpha = 0.5 + Math.sin(count * particle.speed + particle.phase) * 0.2;
    });

    // チリの更新
    dustParticles.forEach(dust => {
      // 左右に揺れながら上昇
      dust.graphics.x += dust.vx + Math.sin(count * dust.speed + dust.phase) * dust.wobbleStrength;
      dust.graphics.y += dust.vy;

      // 画面端で折り返し
      if (dust.graphics.x < -10) dust.graphics.x = xpixi.canvas.width + 10;
      if (dust.graphics.x > xpixi.canvas.width + 10) dust.graphics.x = -10;
      if (dust.graphics.y < -10) {
        dust.graphics.y = xpixi.canvas.height + 10;
        dust.graphics.x = Math.random() * xpixi.canvas.width;
      }

      // 透明度の変化（キラキラ感）
      dust.graphics.alpha = 0.1 + Math.sin(count * dust.speed * 3 + dust.phase) * 0.1;
    });
  });
}

export function BlockBUtton(unit, { text }) {

  xnew.nest(`<button class="relative size-[8cqw] text-[5cqw] text-green-700 hover:scale-110 cursor-pointer transition-transform" style="background: transparent;">`);
  xnew('<div class="absolute inset-[-2cqw] opacity-60" style="background: radial-gradient(circle at center, #000000 0%, transparent 70%);">');

  // 外枠の装飾 (八角形ボーダー)
  xnew('<div class="absolute inset-0 border-[0.3cqw] border-green-700" style="clip-path: polygon(10% 0, 90% 0, 100% 10%, 100% 90%, 90% 100%, 10% 100%, 0 90%, 0 10%);">');

  // 内側の装飾枠 (二重構造)
  xnew('<div class="absolute inset-[0.8cqw] border-[0.2cqw] border-green-600 opacity-60" style="clip-path: polygon(15% 0, 85% 0, 100% 15%, 100% 85%, 85% 100%, 15% 100%, 0 85%, 0 15%);">');

  // 四隅の装飾 (L字型の角飾り)
  xnew(`<div class="absolute size-[1.5cqw] border-green-700 border-t-[0.3cqw] border-l-[0.3cqw]" style="top: -0.2cqw; left: -0.2cqw;">`);
  xnew(`<div class="absolute size-[1.5cqw] border-green-700 border-t-[0.3cqw] border-r-[0.3cqw]" style="top: -0.2cqw; right: -0.2cqw;">`);
  xnew(`<div class="absolute size-[1.5cqw] border-green-700 border-b-[0.3cqw] border-l-[0.3cqw]" style="bottom: -0.2cqw; left: -0.2cqw;">`);
  xnew(`<div class="absolute size-[1.5cqw] border-green-700 border-b-[0.3cqw] border-r-[0.3cqw]" style="bottom: -0.2cqw; right: -0.2cqw;">`);

  xnew('<div class="absolute inset-0 flex items-center justify-center">', GrowText, { text });

  let count = 0;
  unit.on('update', () => {
    unit.element.style.opacity = 0.9 + Math.sin(count * 0.04) * 0.1;
    count++;
  });
}

export function GrowText(unit, { text }) {
  xnew.nest('<div style="text-shadow: 0 0 0.5cqw currentColor;">');
  unit.element.textContent = text;

  let count = 0;
  unit.on('update', () => {
    unit.element.style.textShadow = `0 0 ${0.6 + Math.sin(count * 0.04) * 0.1}cqw currentColor`;
    count++;
  });
}


export function TextStream(unit, { text = '', speed = 50, fade = 300 } = {}) {
    const chars = [];

    for (let i = 0; i < text.length; i++) {
        const unit = xnew('<span>');
        unit.element.textContent = text[i];
        unit.element.style.opacity = '0';
        unit.element.style.transition = `opacity ${fade}ms ease-in-out`;
        chars.push(unit);
    }

    let start = 0;
    unit.on('start', () => {
        start = new Date().getTime();
    });

    let state = 0;
    unit.on('update', () => {
        const index = Math.floor((new Date().getTime() - start) / speed);

        // Display characters up to the current index (fade in)
        for (let i = 0; i < chars.length; i++) {
            if (i <= index) {
                chars[i].element.style.opacity = '1';
            }
        }
        if (state === 0 && index >= text.length) {
            action();
        }
    });
    xnew.timeout(() => {
        xnew(document.body).on('click wheel keydown', action);
    }, 100);

    function action() {
        if (state === 0) {
            state = 1;
            for (let i = 0; i < chars.length; i++) {
                chars[i].element.style.opacity = '1';
            }
            xnew.emit('-complete');
        } else if (state === 1) {
            state = 2;
            xnew.emit('-next');
        }
    }
}