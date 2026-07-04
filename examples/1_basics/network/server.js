//----------------------------------------------------------------------------------------------------
// multi-client（socket.io 版・server 側）— express で静的配信し、socket.io で実ネットワーク同期する。
//   ロビー / ルームの配線はこのファイルで直接組む（xsync が提供するのは boot / state / emit* などの
//   同期ファサードのみで、gathering-place は含まない）。Lobby が接続所有・台帳・一覧配信・入室検証・
//   部屋生成を担い、Room が xsync.boot(Game) + 人数計数 + 空室掃除を担う。room 台帳（id → Room unit）は
//   モジュール共有で、Lobby が唯一の書き手・Room が自分で消す。Node 実行なので Game の xsync.server 分岐
//   だけが動く。ゲーム本体 game.js は無改変。
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

// ---- room 台帳（id → Room unit）: Lobby が書き、Room が自分で消す共有台帳 ----
// 行は { id, name, count }（count = 生存メンバ数）。Room.status() が現在値を返す。
const rooms = new Map();
const roomList = () => [...rooms.values()].map((room) => room.status());
const broadcastRooms = () => io.to('lobby').emit('statusupdate', { rooms: roomList() });

// ---- Lobby（server）: 接続所有・台帳・一覧配信・入室検証・部屋生成 ----
//   room を持たない接続 = ロビー接続として扱い、一覧配信 / 'roomcreate' を受ける。roomId 付き接続で
//   台帳に無いものは 'notfound' で弾く（有効なものは Room 側の boot 配線が扱う）。
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
        unit.on('finalize', () => { io.off('connection', connection); rooms.clear(); });
    });
}

// ---- Room（server）: xsync.boot(Game) + 人数計数 + 空室掃除 ----
//   このルーム宛ての connection を数え、room.count を更新して一覧へ反映する。無人になったら graceMs 後に
//   台帳から外して自分を finalize する（putback 猶予つき）。status() で一覧行を公開する。
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
        unit.on('finalize', () => io.off('connection', connection));

        scheduleCleanup();
        function scheduleCleanup() {
            graceTimer?.clear();
            graceTimer = xnew.timeout(() => {
                if (members.size > 0) { return; }
                if (rooms.has(room.id)) { rooms.delete(room.id); broadcastRooms(); unit.finalize(); }
            }, graceMs);
        }

        return {
            status() { return room; },
        };
    });
}

xnew(Lobby);

httpServer.listen(PORT, () => {
    console.log(`[multi-client] socket.io server on http://localhost:${PORT}/index-multiframe.html`);
    console.log('[multi-client] 4 分割の各フレームで同じルームに入ると、タイトル → 設定 → ゲーム開始の流れを 1 画面で確認できます');
});
