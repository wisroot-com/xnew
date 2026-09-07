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
        this.root = new Unit(Unit.currentUnit, Component, { ...props, _hook: (unit: Unit) => { unit._.sync.root = unit; RoomIO.rooms.set(unit, this); } });
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

    // fires `type` on every unit of this room that listens for it; a '-type' also has to match the emitter's sync node id.
    dispatch(type: string, id: string | undefined, data: Record<string, any> = {}, syncId?: number | null): void {
        // iterate a copy: a handler may finalize units, which mutates both tables mid-dispatch
        [...(Unit.type2units.get(type) ?? [])].forEach((unit) => {
            // socket callbacks run outside the scope machinery: a message landing after / mid-finalize must not fire a dying unit's handler.
            if (unit._.phase === 'finalized' || unit._.phase === 'finalizing') return;
            if (unit._.sync.root !== this.root) return; // skip units of another root
            if (type[0] === '-' && unit._.sync.id !== syncId) return; // skip units of another sync node
            [...(unit._.listeners.get(type) ?? [])].forEach((entry) => entry.execute({ id, ...data }));
        });
    }

    // listens on the own socket (client) or the io namespace (server); detached when the root finalizes, so a dead room leaves no listener on the shared io.
    on(type: string, listener: (...args: any[]) => void): void {
        const wire = this.socket ?? this.io;
        wire.on(type, listener);
        this.root.on('finalize', () => wire.off(type, listener));
    }

    static rooms = new WeakMap<Unit, RoomIO>();   // root unit → the RoomIO that booted it, stamped by the boot hook

    // the room this unit belongs to; every caller needs the real thing, so a unit outside a booted root is an error
    static of(unit: Unit): RoomIO {
        const root = unit._.sync.root;
        const roomio = root === null ? undefined : RoomIO.rooms.get(root);
        if (roomio === undefined) {
            throw new Error('no socket bound to this root; create it with xsync.boot({ io, room } | { io, client, room }, Component).');
        }
        return roomio;
    }
}
