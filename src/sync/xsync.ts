//----------------------------------------------------------------------------------------------------
// xsync — the networking facade (exported as `xsync`): shared state on Unit's _.sync slot, the room
// session, messaging, and boot. The channel wiring itself lives in boot.ts.
//----------------------------------------------------------------------------------------------------

import { Unit, ComponentFn, DefinesOf, PropsOf } from '../core/unit';
import { boot } from './boot';
import { getSide } from './side';
import { RoomIO, BootOptions, ClientStatus, RoomStatus } from './roomio';

//----------------------------------------------------------------------------------------------------
// facade
//----------------------------------------------------------------------------------------------------

export const xsync = {
    server<C extends ComponentFn<any, any>>(callback: C, props?: PropsOf<C>): DefinesOf<C> | {} {
        return getSide() === 'server' ? Unit.extend(Unit.current, callback, props) as DefinesOf<C> : {};
    },
    client<C extends ComponentFn<any, any>>(callback: C, props?: PropsOf<C>): DefinesOf<C> | {} {
        return getSide() === 'client' ? Unit.extend(Unit.current, callback, props) as DefinesOf<C> : {};
    },
    state(initial: Record<string, any> = {}): Record<string, any> {
        const state = Unit.current._.sync.state;
        for (const key of Object.keys(initial)) {
            if (!(key in state)) { state[key] = initial[key]; }
        }
        return state;
    },
    register(Components: Record<string, Function>): void {
        const unit = Unit.current;
        if (unit._.phase !== 'invoked') {
            throw new Error('xsync.register must be called during component initialization.');
        }
        Object.assign(unit._.sync.registry, Components);
    },
    // Restrict this sync node (and its subtree) with a predicate re-evaluated per capture (the way to reveal dynamically); null ⇒ public again.
    visibility(target: ((clientId: string) => boolean) | null): void {
        Unit.current._.sync.visibility = target;
    },
    get session(): { room: RoomStatus; clients: ClientStatus[]; myself: ClientStatus } {
        const roomio = RoomIO.of(Unit.current);
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
        const roomio = RoomIO.of(Unit.current);
        const syncId = Unit.current._.sync.id;
        const to = clients === undefined ? undefined : [clients].flat();
        if (to !== undefined && to.length === 0) { return; }
        if (getSide() === 'server') {
            // the envelope id stays undefined (server-originated), so a relay names the original sender inside data.
            roomio.emit('emitToClients', { type, syncId, id: undefined, data: props }, to);
        } else {
            roomio.emit('emitToServer', { type, syncId, data: props, to: to?.map((client) => client.id) });
        }
    },
    boot<C extends ComponentFn<any, any>>(options: BootOptions, Component: C, props?: PropsOf<C>): Unit {
        return boot(options, Component, props);
    },
};
