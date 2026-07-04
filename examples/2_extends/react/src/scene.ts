import { xnew } from '@mulsense/xnew';

//----------------------------------------------------------------------------------------------------
// Main — xnew 側のシーン本体（DOM のボールを跳ねさせる）。XReact から Component として渡される。
//   React → xnew : 公開メソッド setProps({ color, running, onBounce }) で生きた unit を更新する。
//   xnew → React : 壁で反射するたびに live.onBounce() を呼ぶ。
//----------------------------------------------------------------------------------------------------

export interface MainProps {
    color: string;
    running: boolean;
    onBounce: () => void;
}

interface Ball {
    el: HTMLDivElement;
    size: number;
    x: number; y: number;
    vx: number; vy: number;   // px/ms
}

export function Main(unit: any, initial: MainProps) {
    const stage = xnew.nest('<div class="xnew-stage">') as HTMLDivElement;   // ボールを置くコンテナ（React は触らない）
    let live: MainProps = { ...initial };

    // ボールは plain DOM。位置は自前で積分し、壁で反射したら onBounce を呼ぶ。
    const balls: Ball[] = Array.from({ length: 10 }, () => {
        const size = 18 + Math.random() * 30;
        const el = document.createElement('div');
        el.className = 'xnew-ball';
        el.style.width = el.style.height = `${size}px`;
        stage.appendChild(el);
        return {
            el, size,
            x: Math.random() * 200, y: Math.random() * 200,
            vx: (Math.random() * 2 - 1) * 0.18, vy: (Math.random() * 2 - 1) * 0.18,
        };
    });

    const paint = () => balls.forEach((b) => { b.el.style.background = live.color; });
    paint();

    unit.on('update', ({ delta }: { count: number; delta: number }) => {
        if (!live.running) { return; }
        const w = stage.clientWidth, h = stage.clientHeight;
        for (const b of balls) {
            b.x += b.vx * delta;
            b.y += b.vy * delta;
            let bounced = false;
            if (b.x <= 0) { b.x = 0; b.vx = Math.abs(b.vx); bounced = true; }
            else if (b.x + b.size >= w) { b.x = w - b.size; b.vx = -Math.abs(b.vx); bounced = true; }
            if (b.y <= 0) { b.y = 0; b.vy = Math.abs(b.vy); bounced = true; }
            else if (b.y + b.size >= h) { b.y = h - b.size; b.vy = -Math.abs(b.vy); bounced = true; }
            b.el.style.transform = `translate(${b.x}px, ${b.y}px)`;
            if (bounced) { live.onBounce(); }   // xnew → React へ通知
        }
    });

    // React → xnew: 生きた unit を更新するための公開メソッド（defines は関数のみ可）。
    return {
        setProps(next: Partial<MainProps>) {
            const recolor = next.color !== undefined && next.color !== live.color;
            live = { ...live, ...next };
            if (recolor) { paint(); }
        },
    };
}
