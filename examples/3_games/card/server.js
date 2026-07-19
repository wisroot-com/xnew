//----------------------------------------------------------------------------------------------------
// card（server 側）— express で静的配信し、socket.io で 1 つの固定ルームを同期する。
//   ロビーは無く、全接続が固定ルーム 'main' に入る。server は Game を 1 度 boot するだけ。Node 実行なので
//   Game の xsync.server 分岐（席割当 + Player/Hand 生成 + 手番管理）だけが動く。ゲーム本体 game.js は無改変。
//----------------------------------------------------------------------------------------------------

import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import express from 'express';
import { Server as IOServer } from 'socket.io';
import { xnew, xsync } from '@mulsense/xnew';
import { Game } from './game.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3003;

const app = express();
app.use(express.static(__dirname));                                          // index.html / index.js / game.js / render.js
app.use('/xnew', express.static(join(__dirname, '..', '..', 'dist')));             // ブラウザ用 @mulsense/xnew（examples/dist・addons 含む）
app.use('/thirdparty', express.static(join(__dirname, '..', '..', 'thirdparty')));  // pixi / three / three-vrm / voxelkit / tailwind
app.use('/assets', express.static(join(__dirname, '..', '..', 'assets')));          // *.mog / *.vrma

const httpServer = createServer(app);
const io = new IOServer(httpServer);
const room = { id: 'main', name: 'カードルーム', count: 0 };

// server root: 固定ルームの Game を 1 度だけ boot する（inline は unit を暗黙 return しないようブロック本体で）。
xnew(() => { xsync.boot({ io, room }, Game); });

httpServer.listen(PORT, () => {
    console.log(`[card] socket.io server on http://localhost:${PORT}/`);
    console.log(`[card] http://localhost:${PORT}/index-multiframe.html を開くと 4 画面（4 プレイヤー）を並べて確認できます`);
});
