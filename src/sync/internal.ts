//----------------------------------------------------------------------------------------------------
// sync/internal — shared sync state & transport primitives (used by boot.ts and facade.ts)
//
// Not part of the public surface: this is the plumbing both the boot wiring and the facade sit on.
// The per-unit SyncData (id / state / registry) and the per-root SyncInfo (bound as an ancestor
// context under a private Symbol) are the two pieces of state the whole engine shares.
//
// - syncOf(unit)      : lazily-created per-unit sync data (id / synced state / child registry)
// - rootInfoOf(unit)  : nearest booted root's SyncInfo (throws if not booted)
// - dispatch          : route a received wire event to the listening units of one root
// - relayToClients    : server→client fan-out for emitToClient
// - WIRE_TO_SERVER / WIRE_TO_CLIENT / WIRE_DELIVER : reserved wire event names
//
// Relationships: boot.ts creates SyncInfo + drives dispatch/relay; facade.ts reads syncOf/rootInfoOf
// and calls relayToClients. Public types (ClientStatus / RoomStatus / Boot*Options / SyncNode) are
// re-exported from sync/index.ts.
//----------------------------------------------------------------------------------------------------

import { Unit } from '../core/unit';

export interface SyncNode { id: number; name: string; parent: number | null; state: Record<string, any>; }
export interface SyncData { id: number | null; state: Record<string, any>; registry: Record<string, Function>; }

const syncData: WeakMap<Unit, SyncData> = new WeakMap();

export function syncOf(unit: Unit): SyncData {
    if (syncData.has(unit) === false) {
        syncData.set(unit, { id: null, state: {}, registry: {} });
    }
    return syncData.get(unit)!;
}

/** Seed a unit's SyncData directly (client-side replica creation, before initialize). */
export function seedSyncData(unit: Unit, data: SyncData): void {
    syncData.set(unit, data);
}

/** Read a unit's parent registry (for capture's name resolution) without creating SyncData. */
export function registryOfParent(unit: Unit): Record<string, Function> | undefined {
    return unit._.parent ? syncData.get(unit._.parent)?.registry : undefined;
}

export interface ClientStatus { id: string; name: string; }
export interface RoomStatus { id: string; name: string; count: number; }

export interface ServerInfo { io: any; room: RoomStatus; clients: ClientStatus[]; }
export interface ClientInfo { socket: any; room: RoomStatus; clients: ClientStatus[]; }

export interface BootServerOptions { io: any; room: RoomStatus; }
export interface BootClientOptions { io: any; room: RoomStatus; client: any; }

// A boot root publishes its SyncInfo as an ancestor context; descendants resolve the nearest root via
// Unit.getContext. Private Symbol (avoids xnew.context() collision); auto-cleared on root finalize.
export const SYNC_KEY = Symbol('sync');

/** Internal info of the caller's sync root (throws if not booted). */
export function rootInfoOf(unit: Unit): ServerInfo | ClientInfo {
    const info = Unit.getContext(unit, SYNC_KEY) as ServerInfo | ClientInfo | undefined;
    if (info === undefined) {
        throw new Error('no socket bound to this root; create it with xsync.boot({ io, room } | { io, client, room }, ...).');
    }
    return info;
}

// Reserved wire events for emitToServer / emitToClient (never used as app `type`s).
export const WIRE_TO_SERVER = 'sync:toServer';   // client→server: { type, syncId, data }      → dispatch `type` on the server
export const WIRE_TO_CLIENT = 'sync:toClient';   // client→server: { type, syncId, data, ids } → server fans out to clients
export const WIRE_DELIVER = 'sync:deliver';      // server→client: { type, syncId, id, data }   → dispatch `type` on the client

/** Route a received event to listening units belonging to `info`'s root. */
export function dispatch(info: ServerInfo | ClientInfo, event: string, id: string | undefined, payload: any): void {
    const data = payload && payload.data !== null && typeof payload.data === 'object' ? payload.data : {};
    const syncId = payload ? payload.syncId : undefined;
    (Unit.type2units.get(event) ?? []).forEach((unit) => {
        if (Unit.getContext(unit, SYNC_KEY) !== info) return; // skip units of another root
        if (event[0] === '-' && syncOf(unit).id !== syncId) return; // skip units of another sync node
        unit._.listeners.get(event)?.forEach((item) => item.execute({ id, ...data }));
    });
}

/** Server → clients delivery for emitToClient (ids = target client ids; omitted/empty = whole room). */
export function relayToClients(info: ServerInfo, type: string, senderId: string | undefined, syncId: number | null, data: any, ids?: string[]): void {
    const envelope = { type, syncId, id: senderId, data };
    if (Array.isArray(ids) && ids.length > 0) {
        ids.forEach((cid) => info.io.to(cid).emit(WIRE_DELIVER, envelope));   // each socket is in a room named by its id
    } else {
        info.io.to(info.room.id).emit(WIRE_DELIVER, envelope);
    }
}
