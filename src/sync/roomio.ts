//----------------------------------------------------------------------------------------------------
// RoomIO — the sync root unit plus the io it was booted with (client side: the socket it creates from io)
// the root unit is stamped through the reserved _hook prop, so every descendant resolves the same room from birth.
//----------------------------------------------------------------------------------------------------

import { Unit } from '../core/unit';
import { getSide } from './side';

export interface ClientStatus { id: string; name: string; }
export interface RoomStatus { id: string; name: string; count: number; }
export interface BootOptions { io: any; room: RoomStatus; client?: any; }   // client is client-boot only

export class RoomIO {
    readonly io: any;
    readonly socket: any;           // client side only: the socket this room creates, owns and disconnects
    readonly room: RoomStatus;
    clients: ClientStatus[] = [];   // room roster; kept up to date by boot's status channel
    readonly root: Unit;

    constructor({ io, room, client }: BootOptions, Component: Function, props?: object) {
        this.io = io;
        this.room = room;
        // the handshake query must stay flat strings (socket.io stringifies values).
        this.socket = getSide() === 'client' ? io({ query: { roomId: room.id, clientName: client?.name ?? '' }, forceNew: true }) : null;
        // the hook runs before the root's body, so a xsync.session / xsync.emit inside it already resolves this room
        this.root = new Unit(Unit.current, Component, { ...props, _hook: (unit: Unit) => { unit._.sync.root = unit; RoomIO.rooms.set(unit, this); } });
        if (this.socket !== null) {
            this.root.on('finalize', () => this.socket.disconnect());
        }
    }

    // `clients` is the destination roster entry / entries; omitted it means the whole room (server) or the server itself (client).
    emit(type: string, data: any, clients?: ClientStatus | ClientStatus[]): void {
        if (clients === undefined && this.socket !== null) {
            this.socket.emit(type, data);
        } else {
            // each socket sits in a room named by its own id, so per-client and room-wide delivery share one path
            const targets = clients === undefined ? [this.room.id] : [clients].flat().map((client) => client.id);
            targets.forEach((target) => this.io.to(target).emit(type, data));
        }
    }

    // listens on the own socket (client) or the io namespace (server); detached when the root finalizes, so a dead room leaves no listener on the shared io.
    on(type: string, listener: (...args: any[]) => void): void {
        const wire = this.socket ?? this.io;
        wire.on(type, listener);
        this.root.on('finalize', () => wire.off(type, listener));
    }

    static rooms = new WeakMap<Unit, RoomIO>();   // root unit → the RoomIO that booted it, stamped by the boot hook

    static of(unit: Unit): RoomIO | null;
    static of(unit: Unit, required: true): RoomIO;
    static of(unit: Unit, required?: true): RoomIO | null {
        const root = unit._.sync.root;
        const roomio: RoomIO | null = root === null ? null : RoomIO.rooms.get(root) ?? null;
        if (required === true && roomio === null) {
            throw new Error('no socket bound to this root; create it with xsync.boot({ io, room } | { io, client, room }, Component).');
        }
        return roomio;
    }
}
