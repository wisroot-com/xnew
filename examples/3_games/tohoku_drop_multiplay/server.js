//----------------------------------------------------------------------------------------------------
// tohoku_drop_multiplay（server エントリ）— express 静的配信 + socket.io + ロビー/ルームの配線だけ。
//   ゲームロジック（物理 / 勝敗 / 同期）はすべて game.js の Game に集約。Room の中身として Game を boot し、
//   Node 実行なので Game の xsync.server 分岐（matter）だけが動く。three/pixi は読み込まれない。
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

// ---- HTTP + 静的配信 ----
const app = express();
app.use(express.static(__dirname));                                                 // index.html / index.js / game.js / background.jpg
app.use('/xnew', express.static(join(__dirname, '..', '..', '..', 'dist')));        // ブラウザ用 @mulsense/xnew（addons 含む）
app.use('/thirdparty', express.static(join(__dirname, '..', '..', 'thirdparty')));  // pixi / three / voxelkit / tailwind
app.use('/assets', express.static(join(__dirname, '..', '..', 'assets')));          // 3D モデル(.mog) など

const httpServer = createServer(app);
const io = new IOServer(httpServer);

// ---- ロビー + 動的ルーム（basics を extend し、部屋の中身に Game を据える） ----
function Lobby(unit) {
    xnew.extend(xsync.Lobby, { io, Room });
}

function Room(unit, { io, room }) {
    xnew.extend(xsync.Room, { io, room, Component: Game });
}

xnew(Lobby);

httpServer.listen(PORT, () => {
    console.log(`[tohoku_drop_multiplay] server on http://localhost:${PORT}/index-multiframe.html`);
    console.log('[tohoku_drop_multiplay] 同じルームに 2 人入ると対戦開始。交互にドロップし、先に 200 点で勝ち');
});
