//----------------------------------------------------------------------------------------------------
// RoomIO — the sync root unit plus the io it was booted with (client side: the socket it creates from io)
// boot hangs it on the root's inherited.syncRoot, so every descendant resolves the same room from birth.
//----------------------------------------------------------------------------------------------------

import { Unit } from '../core/unit';
import { getEnvironment } from './environment';

export interface ClientStatus { id: string; name: string; }
export interface RoomStatus { id: string; name: string; count: number; }
export interface BootOptions { io: any; room: RoomStatus; client?: any; }   // client is client-boot only

export class RoomIO {
    readonly io: any;
    readonly socket: any;           // client side only: the socket this room creates, owns and disconnects
    readonly room: RoomStatus;
    clients: ClientStatus[] = [];   // room roster; kept up to date by boot's status channel
    readonly root: Unit;

    constructor({ io, room, client }: BootOptions, ...args: any[]) {
        this.io = io;
        this.room = room;
        // the handshake query must stay flat strings (socket.io stringifies values).
        this.socket = getEnvironment() === 'client' ? io({ query: { roomId: room.id, clientName: client?.name ?? '' }, forceNew: true }) : null;
        this.root = new Unit({ parent: Unit.current, inherited: { syncRoot: this } }, ...args);
        if (this.socket !== null) {
            this.root.on('finalize', () => this.socket.disconnect());
        }
    }

    // `to` is a client id / room id (both are socket.io rooms) or an array of them; null sends to the server.
    emit(to: string | string[] | null, type: string, data: any): void {
        if (Array.isArray(to)) {
            to.forEach((target) => this.io.to(target).emit(type, data));
        } else if (to === null) {
            this.socket.emit(type, data);
        } else {
            this.io.to(to).emit(type, data);
        }
    }

    // listens on the own socket (client) or the io namespace (server); detached when the root finalizes, so a dead room leaves no listener on the shared io.
    on(type: string, listener: (...args: any[]) => void): void {
        const wire = this.socket ?? this.io;
        wire.on(type, listener);
        this.root.on('finalize', () => wire.off(type, listener));
    }

    static of(unit: Unit): RoomIO | null;
    static of(unit: Unit, required: true): RoomIO;
    static of(unit: Unit, required?: true): RoomIO | null {
        const roomio: RoomIO | null = unit._.inherited.syncRoot ?? null;
        if (required === true && roomio === null) {
            throw new Error('no socket bound to this root; create it with xsync.boot({ io, room } | { io, client, room }, ...).');
        }
        return roomio;
    }
}
