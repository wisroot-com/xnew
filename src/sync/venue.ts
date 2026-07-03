//----------------------------------------------------------------------------------------------------
// sync/venue — socket.io ready-made "gathering place" components (Lobby / Room), exposed as xsync.Lobby / xsync.Room
//
// Wire socket.io to the host unit; server/client auto-detected. Both sides receive io: the server
// uses it as the hub; the client calls io() to create its own socket — Lobby creates it inline,
// Room hands io (+ client) to xsync.boot which creates/owns it (→ engine runtime environment).
// The room ledger (id → Room unit) is module-global so Room self-removes/re-broadcasts without a
// Lobby context; Lobby is its sole writer and clears it on finalize. Scene navigation (change/add)
// is the caller's concern — extend Scene on the host unit if you want it (see examples/network).
//
// - Lobby    : lobby + dynamic rooms; client forwards events to '-<event>' and exposes createRoom().
// - Room     : boots Component (boot forwards connect/disconnect/notfound); server counts members + cleanup.
//
// A room-list row is SyncRoomStatus { id, name, count } (count = live member count).
//----------------------------------------------------------------------------------------------------

import { xnew } from '../core/xnew';
import { Unit, UnitTimer } from '../core/unit';
import { SyncBootServerOptions, SyncRoomStatus } from './engine';
import { sync } from './xsync';

const rooms = new Map<string, Unit>();

function roomList(): SyncRoomStatus[] {
    return [...rooms.values()].map((room) => room.status());
}

function broadcastRooms(io: any): void {
    io.to('lobby').emit('statusupdate', { rooms: roomList() });
}

export function Lobby(unit: Unit, props: any) {

    sync.server(() => {
        const { io, Room, maxRooms = 20, roomNameMax = 16 } = props as { io: any; Room: Function; maxRooms?: number; roomNameMax?: number; };
        let nextRoomNum = 0;

        const connection = xnew.scope((conn: any) => {
            const roomId = conn.handshake?.query?.roomId;
            if (roomId !== undefined && roomId !== '') {
                // reject gone/invalid rooms (valid ones are handled by Room's boot wiring).
                if (!rooms.has(roomId)) { conn.emit('notfound', { roomId }); conn.disconnect(true); }
                return;
            }

            conn.join('lobby');
            conn.emit('statusupdate', { rooms: roomList() });
            conn.on('roomcreate', xnew.scope((payload: any) => {
                if (rooms.size >= maxRooms) { conn.emit('roomrejected', { message: 'room limit reached' }); return; }
                const id = `r${++nextRoomNum}`;
                const name = String(payload?.name ?? '').trim().slice(0, roomNameMax) || `Room ${nextRoomNum}`;
                const room = { id, name, count: 0 };
                rooms.set(id, xnew(unit, Room, { io, room }));
                conn.emit('roomcreated', { room });
                broadcastRooms(io);
            }));
        });
        io.on('connection', connection);
        unit.on('finalize', () => { io.off('connection', connection); rooms.clear(); });
    });

    sync.client(() => {
        const { io } = props as { io: any; };
        // ロビー接続は room を持たない（query なし → server はロビー接続として扱う）。socket は Lobby が所有する。
        const socket = io({ forceNew: true });
        
        // 受信イベントを host の '-event' へ転送する（connect/disconnect は payload なし → {}）。
        for (const event of ['connect', 'disconnect', 'statusupdate', 'roomcreated', 'roomrejected']) {
            socket.on(event, xnew.scope((payload: any) => xnew.emit('-' + event, payload ?? {})));
        }
        unit.on('finalize', () => socket.disconnect());
        return { createRoom(name: string) { socket.emit('roomcreate', { name }); } };
    });
}

export function Room(unit: Unit, props: any) {
    const members = new Set<string>();

    sync.server(() => {
        const { io, room, Component, graceMs = 3000 } = props as { io: any; room: SyncBootServerOptions['room']; Component: Function; graceMs?: number; };
        sync.boot({ io, room }, Component);

        let graceTimer: UnitTimer | null = null;

        // socket.io の connection / disconnect を直接受けてこの room のメンバを計数する（room フィルタ付き）。
        const connection = xnew.scope((socket: any) => {
            if (socket.handshake?.query?.roomId !== room.id) { return; }   // 別ルームは無視
            graceTimer?.clear();
            members.add(socket.id);
            room.count = members.size;
            xnew.emit('-connect', { id: socket.id });
            if (rooms.has(room.id)) { broadcastRooms(io); }
            socket.on('disconnect', xnew.scope(() => {
                members.delete(socket.id);
                room.count = members.size;
                xnew.emit('-disconnect', { id: socket.id });
                if (rooms.has(room.id)) { broadcastRooms(io); }
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
                xnew.emit('-empty', {});
                if (rooms.has(room.id)) { rooms.delete(room.id); broadcastRooms(io); unit.finalize(); }
            }, graceMs);
        }

        return {
            status(): SyncRoomStatus { return room; },
        };
    });

    sync.client(() => {
        const { io, client, room, Component } = props as { io: any; client: any; room: SyncRoomStatus; Component: Function; };
        sync.boot({ io, client, room }, Component);
    });
}
