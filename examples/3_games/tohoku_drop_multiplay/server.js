//----------------------------------------------------------------------------------------------------
// tohoku_drop_multiplay（server エントリ）— express 静的配信 + socket.io + ロビー/ルームの配線だけ。
//   ゲームロジック（物理 / 勝敗 / 同期）はすべて game.js の Game に集約。ロビー / ルームの配線はこの
//   ファイルで直接組む（xsync が提供するのは boot / state / emit* などの同期ファサードのみ）。Lobby が
//   接続所有・台帳・一覧配信・入室検証・部屋生成を、Room が xsync.boot(Game) + 人数計数 + 空室掃除を担う。
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

// ---- room 台帳（id → Room unit）: Lobby が書き、Room が自分で消す共有台帳 ----
const rooms = new Map();
const roomList = () => [...rooms.values()].map((room) => room.status());
const broadcastRooms = () => io.to('lobby').emit('statusupdate', { rooms: roomList() });

// ---- Lobby（server）: 接続所有・台帳・一覧配信・入室検証・部屋生成 ----
function Lobby(unit) {
    xsync.server(() => {
        const maxRooms = 20;
        const roomNameMax = 16;
        let nextRoomNum = 0;

        const connection = xnew.scope((conn) => {
            const roomId = conn.handshake?.query?.roomId;
            if (roomId !== undefined && roomId !== '') {
                if (!rooms.has(roomId)) { conn.emit('notfound', { roomId }); conn.disconnect(true); }
                return;
            }
            conn.join('lobby');
            conn.emit('statusupdate', { rooms: roomList() });
            conn.on('roomcreate', xnew.scope((payload) => {
                if (rooms.size >= maxRooms) { conn.emit('roomrejected', { message: 'room limit reached' }); return; }
                const id = `r${++nextRoomNum}`;
                const name = String(payload?.name ?? '').trim().slice(0, roomNameMax) || `Room ${nextRoomNum}`;
                const room = { id, name, count: 0 };
                rooms.set(id, xnew(unit, Room, { io, room }));
                conn.emit('roomcreated', { room });
                broadcastRooms();
            }));
        });
        io.on('connection', connection);
        unit.on('destroy', () => { io.off('connection', connection); rooms.clear(); });
    });
}

// ---- Room（server）: xsync.boot(Game) + 人数計数 + 空室掃除 ----
function Room(unit, { io, room }) {
    xsync.server(() => {
        const graceMs = 3000;
        xsync.boot({ io, room }, Game);

        const members = new Set();
        let graceTimer = null;

        const connection = xnew.scope((socket) => {
            if (socket.handshake?.query?.roomId !== room.id) { return; }   // 別ルームは無視
            graceTimer?.clear();
            members.add(socket.id);
            room.count = members.size;
            if (rooms.has(room.id)) { broadcastRooms(); }
            socket.on('disconnect', xnew.scope(() => {
                members.delete(socket.id);
                room.count = members.size;
                if (rooms.has(room.id)) { broadcastRooms(); }
                if (members.size === 0) { scheduleCleanup(); }
            }));
        });
        io.on('connection', connection);
        unit.on('destroy', () => io.off('connection', connection));

        scheduleCleanup();
        function scheduleCleanup() {
            graceTimer?.clear();
            graceTimer = xnew.timeout(() => {
                if (members.size > 0) { return; }
                if (rooms.has(room.id)) { rooms.delete(room.id); broadcastRooms(); unit.destroy(); }
            }, graceMs);
        }

        return {
            status() { return room; },
        };
    });
}

xnew(Lobby);

httpServer.listen(PORT, () => {
    console.log(`[tohoku_drop_multiplay] server on http://localhost:${PORT}/index-multiframe.html`);
    console.log('[tohoku_drop_multiplay] 同じルームに 2 人入ると対戦開始。交互にドロップし、先に 200 点で勝ち');
});
