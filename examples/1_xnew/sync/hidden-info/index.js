//----------------------------------------------------------------------------------------------------
// hidden-info（client 側）— 固定ルーム 'main' へ接続し、Game を mount する。
//   xsync.boot({ io, client, room }, Game) が socket を生成・所有し、connect/disconnect を App の
//   '-event' へ転送する。Game の client 分岐が Board / 自分ぶんの PlayerView を描画する。
//----------------------------------------------------------------------------------------------------

import { xnew, xsync } from '@mulsense/xnew';
import { Game } from './game.js';

const room = { id: 'main', name: 'メインルーム', count: 0 };

function App(unit) {
    const statusEl = document.getElementById('status');
    // boot は socket を作り、connect/disconnect をこの App（boot 親）へ '-event' として転送する。
    xsync.boot({ io: window.io, client: { name: '' }, room }, Game);
    unit.on('-connect', ({ id }) => { statusEl.textContent = `接続 (${id.slice(0, 4)})`; statusEl.className = 'text-green-600'; });
    unit.on('-disconnect', () => { statusEl.textContent = '切断'; statusEl.className = 'text-red-500'; });
}

xnew(document.getElementById('app'), App);
