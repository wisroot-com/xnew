//----------------------------------------------------------------------------------------------------
// xsync — the networking facade (exported as `xsync`): shared state on Unit's _.sync slot, the room
// session, messaging, and boot. The channel wiring itself lives in boot.ts.
//----------------------------------------------------------------------------------------------------

import { Unit, ComponentFn, DefinesOf, PropsOf } from '../core/unit';
import { bootServer, bootClient } from './boot';
import { getSide } from './side';
import { RoomIO, BootOptions, ClientStatus, RoomStatus } from './roomio';

//----------------------------------------------------------------------------------------------------
// facade
//----------------------------------------------------------------------------------------------------

export const xsync = {
    server<C extends ComponentFn<any, any>>(callback: C, props?: PropsOf<C>): DefinesOf<C> | {} {
        return getSide() === 'server' ? Unit.extend(Unit.currentUnit, callback, props) as DefinesOf<C> : {};
    },
    client<C extends ComponentFn<any, any>>(callback: C, props?: PropsOf<C>): DefinesOf<C> | {} {
        return getSide() === 'client' ? Unit.extend(Unit.currentUnit, callback, props) as DefinesOf<C> : {};
    },
    state(initial: Record<string, any> = {}): Record<string, any> {
        const state = Unit.currentUnit._.sync.state;
        for (const key of Object.keys(initial)) {
            if (!(key in state)) { state[key] = initial[key]; }
        }
        return state;
    },
    register(Components: Record<string, Function>): void {
        const unit = Unit.currentUnit;
        if (unit._.phase !== 'invoked') {
            throw new Error('xsync.register must be called during component initialization.');
        }
        Object.assign(unit._.sync.registry, Components);
    },
    // Restrict this sync node (and its subtree) with a predicate re-evaluated per capture (the way to reveal dynamically); null ⇒ public again.
    visibility(target: ((clientId: string) => boolean) | null): void {
        Unit.currentUnit._.sync.visibility = target;
    },
    get session(): { room: RoomStatus; clients: ClientStatus[]; myself: ClientStatus } {
        const roomio = RoomIO.of(Unit.currentUnit);
        return {
            get room(): RoomStatus { return roomio.room; },
            get clients(): ClientStatus[] { return roomio.clients; },
            get myself(): ClientStatus {
                if (getSide() === 'server') {
                    throw new Error('xsync.session.myself is only available on the client side.');
                }
                const socket = roomio.socket;
                return roomio.clients.find((c) => c.id === socket.id) ?? { id: socket.id, name: '' };
            },
        };
    },
    // One send across client→server→client: `clients` (a ClientStatus or an array of them) is always delivered by the server — a client's targeted send is relayed, never socket to socket; omitted it means one hop (client→server / server→the whole room), and an empty array reaches nobody.
    emit(type: string, props: Record<string, any> = {}, clients?: ClientStatus | ClientStatus[]): void {
        const roomio = RoomIO.of(Unit.currentUnit);
        const syncId = Unit.currentUnit._.sync.id;
        const to = clients === undefined ? undefined : [clients].flat();
        if (to !== undefined && to.length === 0) { return; }
        if (getSide() === 'server') {
            // the envelope id stays undefined (server-originated), so a relay names the original sender inside data.
            roomio.emit('emitToClients', { type, syncId, id: undefined, data: props }, to);
        } else {
            roomio.emit('emitToServer', { type, syncId, data: props, to: to?.map((client) => client.id) });
        }
    },
    // Seats played by the server itself: roster entries that no socket stands behind. All server side only.
    cpu: {
        // Adds one. The room and its games see it through session.clients and 'sync.connect' exactly like a
        // member who arrived over the wire, while the wire skips it: nothing is projected to it, and nothing
        // can arrive from it — the server acts for it with xsync.cpu.dispatch.
        join(client: { id: string, name?: string }): ClientStatus {
            if (getSide() !== 'server') {
                throw new Error('xsync.cpu.join is only available on the server side.');
            }
            return RoomIO.of(Unit.currentUnit).joinCpu(client);
        },
        // Removes one; true when one was removed (a real client leaves by disconnecting its socket).
        leave(id: string): boolean {
            if (getSide() !== 'server') {
                throw new Error('xsync.cpu.leave is only available on the server side.');
            }
            return RoomIO.of(Unit.currentUnit).leaveCpu(id);
        },
        // Acts for one: dispatches `type` on this room as if that member had sent it, so a move the server
        // decided enters through the same handler — and the same validation — as one that came off the wire.
        dispatch(type: string, id: string, props: Record<string, any> = {}): void {
            if (getSide() !== 'server') {
                throw new Error('xsync.cpu.dispatch is only available on the server side.');
            }
            if (type.startsWith('sync.') === true) {
                throw new Error(`xsync.cpu.dispatch: "sync." is the library's own namespace, only boot may dispatch it [${type}]`);
            }
            const roomio = RoomIO.of(Unit.currentUnit);
            // a real member's action must always have come from that member's socket, so only CPU ids are actable
            if (roomio.clients.find((client) => client.id === id)?.cpu !== true) {
                throw new Error(`xsync.cpu.dispatch: "${id}" is not a CPU member of this room.`);
            }
            roomio.dispatch(type, id, props);
        },
    },
    // one root component only: listeners for sync.* must live inside it, so compose with xnew.extend rather than a second argument.
    boot<C extends ComponentFn<any, any>>(options: BootOptions, Component: C, props?: PropsOf<C>): Unit {
        // the root (and its body) exists once RoomIO is built; the channels only wire onto it
        const roomio = new RoomIO(options, Component, props);
        return getSide() === 'server' ? bootServer(roomio) : bootClient(roomio);
    },
};
