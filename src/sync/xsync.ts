//----------------------------------------------------------------------------------------------------
// sync — networking layer entry (defines the xsync.* facade + assembles the ready-made components)
//
// The public barrel (src/index.ts) re-exports `xsync` from here; addons never touch these internals.
// engine/venue provide the primitives; this file is where they become the user-facing surface.
//
// - sync  : the facade methods themselves (server / client / state / register / emitTo* / room /
//           clients / myself / boot), built from engine primitives. Also imported by venue.
// - xsync : `sync` merged with the Lobby / Room components. Callers rely on TS inference from the
//           method signatures; no named public type aliases are exported.
//
// Caveat: xsync copies the facade via getOwnPropertyDescriptors, NOT Object.assign — room / clients /
// myself are getters that resolve the current unit lazily, and Object.assign would invoke them at
// module load (no current unit → throw). defineProperties drops the facade type from its return, so
// the result is cast back.
//
// Caveat: venue imports `sync` from here while this file imports Lobby / Room from venue — a cycle that
// is safe because venue only touches `sync` inside component bodies (runtime), and the merge below runs
// after venue has finished evaluating (Lobby / Room are already defined).
//----------------------------------------------------------------------------------------------------

import { Unit, ComponentFn, DefinesOf, PropsOf } from '../core/unit';
import {
    getEnvironment, syncOf, rootInfoOf, relayToClients, bootServer, bootClient,
    WIRE_TO_SERVER, WIRE_TO_CLIENT,
    SyncClientStatus, SyncRoomStatus, SyncBootServerOptions, SyncBootClientOptions, ServerInfo, ClientInfo,
} from './engine';
import { Lobby, Room } from './venue';

// test seam: replicas' per-unit sync data (drive capture/apply through boot's 'sync' emit, not directly)
export { syncOf } from './engine';
export type { SyncNode } from './engine';

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
    get room(): SyncRoomStatus {
        return rootInfoOf(Unit.currentUnit).room;
    },
    get clients(): SyncClientStatus[] {
        return rootInfoOf(Unit.currentUnit).clients;
    },
    get myself(): SyncClientStatus {
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
    boot(opts: SyncBootServerOptions | SyncBootClientOptions, ...args: any[]): Unit {
        if (Unit.engineRoot === undefined) { Unit.reset(); }
        return getEnvironment() === 'server'
            ? bootServer(opts as SyncBootServerOptions, Unit.currentUnit, args)
            : bootClient(opts as SyncBootClientOptions, Unit.currentUnit, args);
    },
};

export const xsync = Object.defineProperties(
    { Lobby, Room },
    Object.getOwnPropertyDescriptors(sync),
) as typeof sync & { Lobby: typeof Lobby; Room: typeof Room };
