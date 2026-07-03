//----------------------------------------------------------------------------------------------------
// sync/facade — the xsync.* method surface (server↔client sync), operating on the current unit
//
// Every method resolves the "current" unit / nearest booted root, so it reads its target from the
// running lifecycle rather than an explicit handle. room / clients / myself are getters (lazy resolve).
//
// Public facade (exposed as xsync.*, assembled in sync/index.ts):
// - server / client : extend the current unit only on its runtime (Node=server / browser=client)
// - state           : declare synced state on the current unit (server authoritative)
// - register        : declare the components allowed as direct sync children {Name: Component}
// - emitToServer    : fire `type` on the SERVER. client→server (syncId-scoped dispatch, sender id);
//                     on the server it is a local emit (same as xnew.emit).
// - emitToClient    : fire `type` on the CLIENTS (via the server). client→server→all clients (incl. self);
//                     on the server it broadcasts to clients. ids? = target client ids (default: all).
// - room / clients  : current room info / connected clients
// - myself          : this client's entry (client side only)
// - boot            : create a sync root bound to a socket (server/client auto-detected → boot.ts)
//
// Caveat: room / clients / myself are getters. Reassembling this object must preserve them as getters
// (see sync/index.ts) — copying by value would evaluate them with no current unit and throw.
//----------------------------------------------------------------------------------------------------

import { Unit, ComponentFn, DefinesOf, PropsOf } from '../core/unit';
import { getEnvironment } from '../core/env';
import {
    ClientStatus, RoomStatus, ServerInfo, ClientInfo, BootServerOptions, BootClientOptions,
    syncOf, rootInfoOf, relayToClients, WIRE_TO_SERVER, WIRE_TO_CLIENT,
} from './internal';
import { bootServer, bootClient } from './boot';

export const sync = {
    server<C extends ComponentFn<any, any>>(callback: C, props?: PropsOf<C>): DefinesOf<C> | {} {
        return getEnvironment() === 'server' ? Unit.extend(Unit.currentUnit, callback, props) as DefinesOf<C> : {};
    },
    client<C extends ComponentFn<any, any>>(callback: C, props?: PropsOf<C>): DefinesOf<C> | {} {
        return getEnvironment() === 'client' ? Unit.extend(Unit.currentUnit, callback, props) as DefinesOf<C> : {};
    },
    state(initial: Record<string, any> = {}): Record<string, any> {
        const data = syncOf(Unit.currentUnit);
        for (const key of Object.keys(initial)) {
            if (!(key in data.state)) { data.state[key] = initial[key]; }
        }
        return data.state;
    },
    register(Components: Record<string, Function>): void {
        const unit = Unit.currentUnit;
        if (unit._.status !== 'invoked') {
            throw new Error('xsync.register must be called during component initialization.');
        }
        Object.assign(syncOf(unit).registry, Components);
    },
    get room(): RoomStatus {
        return rootInfoOf(Unit.currentUnit).room;
    },
    get clients(): ClientStatus[] {
        return rootInfoOf(Unit.currentUnit).clients;
    },
    get myself(): ClientStatus {
        if (getEnvironment() === 'server') {
            throw new Error('xsync.myself is only available on the client side.');
        }
        const info = rootInfoOf(Unit.currentUnit) as ClientInfo;
        return info.clients.find((c) => c.id === info.socket.id) ?? { id: info.socket.id, name: '' };
    },
    emitToServer(type: string, props: Record<string, any> = {}): void {
        const info = rootInfoOf(Unit.currentUnit);
        if (getEnvironment() === 'server') {
            Unit.emit(Unit.currentUnit, type, props);
        } else {
            (info as ClientInfo).socket.emit(WIRE_TO_SERVER, { type, syncId: syncOf(Unit.currentUnit).id, data: props });
        }
    },
    emitToClient(type: string, props: Record<string, any> = {}, ids?: string[]): void {
        const info = rootInfoOf(Unit.currentUnit);
        const syncId = syncOf(Unit.currentUnit).id;
        if (getEnvironment() === 'server') {
            relayToClients(info as ServerInfo, type, undefined, syncId, props, ids);
        } else {
            (info as ClientInfo).socket.emit(WIRE_TO_CLIENT, { type, syncId, data: props, ids });
        }
    },
    boot(opts: BootServerOptions | BootClientOptions, ...args: any[]): Unit {
        if (Unit.engineRoot === undefined) { Unit.reset(); }
        return getEnvironment() === 'server'
            ? bootServer(opts as BootServerOptions, Unit.currentUnit, args)
            : bootClient(opts as BootClientOptions, Unit.currentUnit, args);
    },
};
