//----------------------------------------------------------------------------------------------------
// multi-client（socket.io 版・server 側）— express で静的配信し、socket.io で実ネットワーク同期する。
//   ロビー / ルームの汎用配線は xsync.Lobby / Room に任せる（接続所有・台帳・一覧配信・人数計数・
//   空室掃除・入室検証）。本ファイルの Lobby / Room はそれを extend し、部屋の作り方（中身 Component=Game）
//   だけを与える: basics Lobby の '-create' を受けて xnew(Room, ...) を作成し accept で台帳へ登録する。
//   Node 実行なので mode は server に自動判定される。ゲーム本体 game.js は無改変。
//----------------------------------------------------------------------------------------------------

import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import express from 'express';
import { Server as IOServer } from 'socket.io';
import { xnew, xsync } from '@mulsense/xnew';
import { Game } from './game.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;

// ---- HTTP + 静的配信 ----
const app = express();
app.use(express.static(__dirname));                                          // index.html / index.js / game.js
app.use('/xnew', express.static(join(__dirname, '..', '..', '..', 'dist')));        // ブラウザ用 @mulsense/xnew（addons 含む）
app.use('/thirdparty', express.static(join(__dirname, '..', '..', 'thirdparty')));  // tailwindcss playcdn

const httpServer = createServer(app);
const io = new IOServer(httpServer);

// ---- ロビー + 動的ルーム（basics を extend し、部屋の中身だけ与える） ----
// basics Lobby が接続所有・台帳・一覧配信・入室検証・部屋生成まで行う。生成に使う Room コンポーネントを注入する。
function Lobby(unit) {
    xnew.extend(xsync.Lobby, { io, Room });
}

// 1 部屋 = basics Room を extend し、中身 Component に Game を据える（basics Lobby から room={id,name} を受け取る）。
function Room(unit, { io, room }) {
    xnew.extend(xsync.Room, { io, room, Component: Game });
}

xnew(Lobby);

httpServer.listen(PORT, () => {
    console.log(`[multi-client] socket.io server on http://localhost:${PORT}/index-multiframe.html`);
    console.log('[multi-client] 4 分割の各フレームで同じルームに入ると、タイトル → 設定 → ゲーム開始の流れを 1 画面で確認できます');
});
