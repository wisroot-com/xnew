//----------------------------------------------------------------------------------------------------
// RoomIO — the sync root unit plus the io it was booted with (client side: the socket it creates from io)
// the root unit is stamped through the reserved preinit prop, so every descendant resolves the same room from birth.
//----------------------------------------------------------------------------------------------------

import { Unit } from '../core/unit';
import { getSide } from './side';

// `virtual` marks a roster entry with no socket behind it (added with xsync.attach): it is announced and
// listed like anyone else, but nothing is ever sent to it (see RoomIO.emit and boot's per-client projection).
export interface ClientStatus { id: string; name: string; virtual?: boolean; }
export interface RoomStatus { id: string; name: string; count: number; }
export interface BootOptions { io: any; room: RoomStatus; client?: any; }   // client is client-boot only

export class RoomIO {
    readonly io: any;
    readonly socket: any;           // client side only: the socket this room creates, owns and disconnects
    readonly room: RoomStatus;
    clients: ClientStatus[] = [];   // room roster; kept up to date by boot's status channel (and by attach / detach)
    readonly root: Unit;

    constructor({ io, room, client }: BootOptions, Component: Function, props?: object) {
        this.io = io;
        this.room = room;
        // the handshake query must stay flat strings (socket.io stringifies values).
        this.socket = getSide() === 'client' ? io({ query: { roomId: room.id, clientName: client?.name ?? '' }, forceNew: true }) : null;
        // preinit runs before the root's body, so a xsync.session / xsync.emit inside it already resolves this room
        this.root = new Unit(Unit.currentUnit, Component, { ...props, preinit: (unit: Unit) => { unit._.sync.root = unit; RoomIO.rooms.set(unit, this); } });
        // A booted room is a protection boundary: one Node process holds many rooms, and they all share the
        // same Component functions, so an unscoped xnew.find / '+event' would otherwise reach into the others.
        this.root._.protected = true;
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
            // a virtual member has no socket to deliver to, so it drops out of the destinations here
            const targets = clients === undefined ? [this.room.id] : [clients].flat().filter((client) => client.virtual !== true).map((client) => client.id);
            targets.forEach((target) => this.io.to(target).emit(type, data));
        }
    }

    // fires `type` on every unit of this room that listens for it; a '-type' also has to match the emitter's sync node id.
    // the sync node counterpart counts as "the emitter's own unit", so '-' scopes by sync id here rather than by unit identity as Unit.emit does.
    dispatch(type: string, id: string | undefined, data: Record<string, any> = {}, syncId?: number | null): void {
        Unit.dispatch(type, { id, ...data }, (unit) => {
            if (unit._.sync.root !== this.root) return false; // skip units of another root
            if (type[0] === '-' && unit._.sync.id !== syncId) return false; // skip units of another sync node
            return true;
        });
    }

    // listens on the own socket (client) or the io namespace (server); detached when the root finalizes, so a dead room leaves no listener on the shared io.
    on(type: string, listener: (...args: any[]) => void): void {
        const wire = this.socket ?? this.io;
        wire.on(type, listener);
        this.root.on('finalize', () => wire.off(type, listener));
    }

    // Roster announcement (server side): dispatch here, relay to the other members, then re-broadcast the roster.
    // `sender` is the socket the change came from — it is left out of the relay because it dispatches the same
    // event from its own socket. A virtual member has no sender, so the relay goes to the whole room.
    announce(type: string, id: string, sender: any = null): void {
        this.dispatch(type, id);
        (sender ?? this.io).to(this.room.id).emit('emitToClients', { type, syncId: null, id, data: {} });
        this.emit('status', { clients: this.clients });
        this.dispatch('sync.status', undefined);
    }

    // Adds a roster entry that no socket stands behind. It joins exactly the way a connection does
    // ('sync.connect' + a fresh roster), so the tree cannot tell it from a member who arrived over the wire.
    attach({ id, name = '' }: { id: string; name?: string }): ClientStatus {
        if (id === '') { throw new Error('xsync.attach: a virtual member needs an id.'); }
        if (this.clients.some((client) => client.id === id) === true) { throw new Error(`xsync.attach: "${id}" is already in this room.`); }
        const client: ClientStatus = { id, name, virtual: true };
        this.clients.push(client);
        this.announce('sync.connect', id);
        return client;
    }

    // Removes a virtual member. A real client leaves by disconnecting its socket, so it is refused here.
    detach(id: string): boolean {
        const client = this.clients.find((entry) => entry.id === id);
        if (client === undefined || client.virtual !== true) { return false; }
        this.clients = this.clients.filter((entry) => entry !== client);
        this.announce('sync.disconnect', id);
        return true;
    }

    static rooms = new WeakMap<Unit, RoomIO>();   // root unit → the RoomIO that booted it, stamped by the boot preinit

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
