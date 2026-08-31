//----------------------------------------------------------------------------------------------------
// hidden-info（client 側）— 固定ルーム 'main' へ接続し、Game を mount する。
//   xsync.boot({ io, client, room }, Game) が socket を生成・所有し、sync.connect / sync.disconnect を
//   root 配下へ配る（id で自他判別）。Game の client 分岐が Board / 自分ぶんの PlayerView を描画する。
//----------------------------------------------------------------------------------------------------

import { xnew, xsync } from '@mulsense/xnew';
import { Game } from './game.js';

const room = { id: 'main', name: 'メインルーム', count: 0 };

function App(unit) {
    const statusEl = document.getElementById('status');
    // boot は socket を作り、sync.connect / sync.disconnect を root 配下へ配る（表示は id が自分のぶんだけ反映）。
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
