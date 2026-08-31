//----------------------------------------------------------------------------------------------------
// card（client 側）— 固定ルーム 'main' へ接続し、Game を mount する。
//   render.js（Pixi/Three 束）を window.gfx へ載せてから boot する。boot が socket を生成・所有し、
//   connect/disconnect を App の '-event' へ転送する。game.js の client 分岐が盤面を描く。
//----------------------------------------------------------------------------------------------------

import { xnew, xsync } from '@mulsense/xnew';
import * as gfx from './render.js';
import { Game } from './game.js';

window.gfx = gfx;   // browser 専用のグラフィックス束（io を window.io で渡すのと同じ流儀）

const room = { id: 'main', name: 'カードルーム', count: 0 };

function App(unit) {
    const statusEl = document.getElementById('status');
    xsync.boot({ io: window.io, client: { name: '' }, room }, (u) => {
        xnew.extend(Game);
        u.on('sync.connect', ({ id }) => {
            if (id === xsync.session.myself.id) { statusEl.textContent = `接続 (${id.slice(0, 4)})`; statusEl.className = 'text-green-600'; }
        });
        u.on('sync.disconnect', ({ id }) => {
            if (id === xsync.session.myself.id) { statusEl.textContent = '切断'; statusEl.className = 'text-red-500'; }
        });
    });
}

xnew(document.getElementById('app'), App);
