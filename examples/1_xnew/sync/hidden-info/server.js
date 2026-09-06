//----------------------------------------------------------------------------------------------------
// hidden-info（server 側）— express で静的配信し、socket.io で 1 つの固定ルームを同期する。
//   ロビーは無く、全接続が固定ルーム 'main' に入る。server は Game を 1 度 boot するだけ。Node 実行なので
//   Game の xsync.server 分岐（PlayerView 生成 + visibility 宣言）だけが動く。ゲーム本体 game.js は無改変。
//----------------------------------------------------------------------------------------------------

import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import express from 'express';
import { Server as IOServer } from 'socket.io';
import { xnew, xsync } from '@mulsense/xnew';
import { Game } from './game.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3002;

const app = express();
app.use(express.static(__dirname));                                                       // index.html / index.js / game.js
app.use('/xnew', express.static(join(__dirname, '..', '..', '..', '..', 'dist')));        // ブラウザ用 @mulsense/xnew
app.use('/thirdparty', express.static(join(__dirname, '..', '..', '..', 'thirdparty')));  // tailwindcss playcdn

const httpServer = createServer(app);
const io = new IOServer(httpServer);
const room = { id: 'main', name: 'メインルーム', count: 0 };

// server root: 固定ルームの Game を 1 度だけ boot する（inline は unit を暗黙 return しないようブロック本体で）。
xnew(() => { xsync.boot({ io, room }, Game); });

httpServer.listen(PORT, () => {
    console.log(`[hidden-info] socket.io server on http://localhost:${PORT}/`);
    console.log(`[hidden-info] 同じ URL を複数タブで開くか、http://localhost:${PORT}/index-multiframe.html で 2 画面を並べると、各プレイヤーに別々の秘密の数字が配られます`);
});
