//----------------------------------------------------------------------------------------------------
// sync/engine — the whole server↔client sync engine + the xsync.* facade in one module
//
// Layered internally: shared state (syncOf / SyncInfo context) → transport (dispatch / relay / wire) →
// boot wiring (bootServer / bootClient) → facade (`sync`). The server root is the source of truth: on
// each update it captures its sync targets as a flat pre-order node list and emits 'sync'; each client
// root diff-applies that tree. A sync target is a unit whose type is registered in its parent registry.
//
// Public surface (assembled as xsync.* in sync/xsync.ts):
// - server / client : extend the current unit only on its runtime (Node=server / browser=client)
// - state           : declare synced state on the current unit (server authoritative)
// - register        : declare the components allowed as direct sync children {Name: Component}
// - emitToServer    : fire `type` on the SERVER (client→server; local emit on the server)
// - emitToClient    : fire `type` on the CLIENTS via the server (broadcast; ids? limits targets)
// - room / clients / myself : current room / connected clients / this client (getters)
// - boot            : create a sync root bound to a socket (server/client auto-detected)
//
// Invariants: node ids are monotonic per server root (`nextId`), so a unit keeps its id for life;
// capture runs on the root's own update (fires AFTER children update → sees this tick's mutations).
// captureStateTree / applyStateTree are boot-internal closures over `root`; drive them only through
// the 'sync' emit/apply seam. room / clients / myself are getters — reassembling `sync` must preserve
// them as getters (see sync/xsync.ts), copying by value would evaluate them with no current unit.
//
// syncOf is exported as a test seam (replicas' per-unit sync data); everything else stays internal.
//----------------------------------------------------------------------------------------------------

import { Unit, ComponentFn, DefinesOf, PropsOf } from '../core/unit';
import { getEnvironment } from '../core/env';

//---- shared state -----------------------------------------------------------------------------------

export interface SyncNode { id: number; name: string; parent: number | null; state: Record<string, any>; }
interface SyncData { id: number | null; state: Record<string, any>; registry: Record<string, Function>; }

const syncData: WeakMap<Unit, SyncData> = new WeakMap();

export function syncOf(unit: Unit): SyncData {
    if (syncData.has(unit) === false) {
        syncData.set(unit, { id: null, state: {}, registry: {} });
    }
    return syncData.get(unit)!;
}

export interface ClientStatus { id: string; name: string; }
export interface RoomStatus { id: string; name: string; count: number; }

interface ServerInfo { io: any; room: RoomStatus; clients: ClientStatus[]; }
interface ClientInfo { socket: any; room: RoomStatus; clients: ClientStatus[]; }

export interface BootServerOptions { io: any; room: RoomStatus; }
export interface BootClientOptions { io: any; room: RoomStatus; client: any; }

// A boot root publishes its SyncInfo as an ancestor context; descendants resolve the nearest root via
// Unit.getContext. Private Symbol (avoids xnew.context() collision); auto-cleared on root finalize.
const SYNC_KEY = Symbol('sync');

/** Internal info of the caller's sync root (throws if not booted). */
function rootInfoOf(unit: Unit): ServerInfo | ClientInfo {
    const info = Unit.getContext(unit, SYNC_KEY) as ServerInfo | ClientInfo | undefined;
    if (info === undefined) {
        throw new Error('no socket bound to this root; create it with xsync.boot({ io, room } | { io, client, room }, ...).');
    }
    return info;
}

//---- transport --------------------------------------------------------------------------------------

// Reserved wire events for emitToServer / emitToClient (never used as app `type`s).
const WIRE_TO_SERVER = 'sync:toServer';   // client→server: { type, syncId, data }      → dispatch `type` on the server
const WIRE_TO_CLIENT = 'sync:toClient';   // client→server: { type, syncId, data, ids } → server fans out to clients
const WIRE_DELIVER = 'sync:deliver';      // server→client: { type, syncId, id, data }   → dispatch `type` on the client

/** Route a received event to listening units belonging to `info`'s root. */
function dispatch(info: ServerInfo | ClientInfo, event: string, id: string | undefined, payload: any): void {
    const data = payload && payload.data !== null && typeof payload.data === 'object' ? payload.data : {};
    const syncId = payload ? payload.syncId : undefined;
    (Unit.type2units.get(event) ?? []).forEach((unit) => {
        if (Unit.getContext(unit, SYNC_KEY) !== info) return; // skip units of another root
        if (event[0] === '-' && syncOf(unit).id !== syncId) return; // skip units of another sync node
        unit._.listeners.get(event)?.forEach((item) => item.execute({ id, ...data }));
    });
}

/** Server → clients delivery for emitToClient (ids = target client ids; omitted/empty = whole room). */
function relayToClients(info: ServerInfo, type: string, senderId: string | undefined, syncId: number | null, data: any, ids?: string[]): void {
    const envelope = { type, syncId, id: senderId, data };
    if (Array.isArray(ids) && ids.length > 0) {
        ids.forEach((cid) => info.io.to(cid).emit(WIRE_DELIVER, envelope));   // each socket is in a room named by its id
    } else {
        info.io.to(info.room.id).emit(WIRE_DELIVER, envelope);
    }
}

//---- boot -------------------------------------------------------------------------------------------

function bootServer(opts: BootServerOptions, parent: Unit, args: any[]): Unit {
    const { io, room } = opts;
    const info: ServerInfo = { io, room, clients: [] };

    // Bind info as ancestor context before init so the body can resolve it.
    const root = new Unit(parent);
    Unit.addContext(root, root, SYNC_KEY, info);
    Unit.initialize(root, ...args);

    // capture this root's sync targets as a flat pre-order node list (closed over `root`).
    // A sync target is a unit whose type is registered in its direct parent's registry.
    // nextId is monotonic across captures so a unit keeps its id for its whole lifetime.
    let nextId = 1;
    const captureStateTree = (): SyncNode[] => {
        const nodes: SyncNode[] = [];
        // _.Components is [base..., most-derived]; match the registered name from the tail.
        const syncName = (unit: Unit): string | undefined => {
            const registry = unit._.parent ? syncData.get(unit._.parent)?.registry : null;
            if (registry === null || registry === undefined) { return undefined; }
            const entries = Object.entries(registry);
            for (let i = unit._.Components.length - 1; i >= 0; i--) {
                const hit = entries.find(([, Component]) => Component === unit._.Components[i]);
                if (hit !== undefined) { return hit[0]; }
            }
            return undefined;
        };
        const walk = (unit: Unit, parent: number | null): void => {
            const name = syncName(unit);
            if (name !== undefined) {
                const data = syncOf(unit);
                data.id ??= nextId++;
                nodes.push({ id: data.id, name, parent, state: { ...data.state } });
                parent = data.id;
            }
            unit._.children.forEach((child) => walk(child, parent));
        };
        walk(root, null);
        return nodes;
    };

    root.on('update', () => io.to(room.id).emit('sync', captureStateTree()));
    io.on('connection', (socket: any) => {
        const query = socket.handshake?.query;
        if (query?.roomId !== room.id) return; // ignore other rooms
        socket.join(room.id);
        info.clients.push({ id: socket.id, name: query?.clientName ?? '' });
        dispatch(info, 'sync.connect', socket.id, undefined);
        statusUpdate();
        socket.onAny((event: string, payload: any) => {
            // emitToServer: fire `type` on the server (sender id attached, syncId-scoped for '-' types).
            if (event === WIRE_TO_SERVER) {
                dispatch(info, payload?.type, socket.id, payload);
            // emitToClient: relay `type` to the target clients (incl. the sender), with the sender id attached.
            } else if (event === WIRE_TO_CLIENT) {
                relayToClients(info, payload?.type, socket.id, payload?.syncId ?? null, payload?.data, payload?.ids);
            }
        });
        socket.on('disconnect', () => {
            info.clients = info.clients.filter((c) => c.id !== socket.id);
            dispatch(info, 'sync.disconnect', socket.id, undefined);
            statusUpdate();
        });
    });
    function statusUpdate() {
        io.to(room.id).emit('status', { clients: info.clients });
        dispatch(info, 'sync.statusupdate', undefined, undefined);
    }
    return root;
}

function bootClient(opts: BootClientOptions, parent: Unit, args: any[]): Unit {
    const { io, room, client } = opts;
    // client owns its socket: io() with flat string query (roomId / clientName) on the handshake.
    // create it before init so the component body can already read it (xsync.myself / xsync.emitToServer).
    const socket = io({ query: { roomId: room.id, clientName: client?.name ?? '' }, forceNew: true });
    const info: ClientInfo = { socket, room, clients: [] };

    // Bind info as ancestor context before init so the body can resolve it.
    const root = new Unit(parent);
    Unit.addContext(root, root, SYNC_KEY, info);
    Unit.initialize(root, ...args);

    // diff-apply a captured tree onto this client root (create/update/remove; tree is pre-order).
    // reconcileMap tracks node id → replica unit for this root only (closed over `root`).
    const reconcileMap = new Map<number, Unit>();
    const applyStateTree = (tree: SyncNode[]): void => {
        const incoming = new Set<number>(tree.map((node) => node.id));
        // create / update (pre-order, so the parent already exists)
        for (const node of tree) {
            const existing = reconcileMap.get(node.id);
            if (existing !== undefined) {
                Object.assign(syncOf(existing).state, node.state);   // never delete a once-set key (v1 simplification)
                continue;
            }
            const nodeParent = node.parent === null ? root : reconcileMap.get(node.parent);
            const Component = nodeParent && syncOf(nodeParent).registry[node.name];
            if (!Component) { continue; }
            // seed SyncData before initialize so the body's xsync.state sees the server state and fixed id
            const unit = new Unit(nodeParent);
            syncData.set(unit, { id: node.id, state: { ...node.state }, registry: {} });
            Unit.initialize(unit, Component);
            reconcileMap.set(node.id, unit);
        }
        // remove replicas whose id vanished from the tree
        for (const [id, unit] of [...reconcileMap.entries()]) {
            if (!incoming.has(id)) { unit.finalize(); reconcileMap.delete(id); }
        }
    };

    socket.on('sync', applyStateTree);
    const onStatus = (status: { clients?: ClientStatus[] }) => {
        info.clients = status?.clients ?? [];
        dispatch(info, 'sync.statusupdate', undefined, undefined);
    };
    socket.on('status', onStatus);
    socket.onAny((event: string, payload: any) => {
        // emitToServer/emitToClient delivery: the server forwards everything as WIRE_DELIVER ({ type, syncId, id, data }).
        if (event === WIRE_DELIVER) { dispatch(info, payload?.type, payload?.id, payload); }
    });

    // forward the socket's own lifecycle to the host unit (boot parent) as local '-events',
    // so callers listen with unit.on('-connect' | '-disconnect' | '-notfound').
    socket.on('connect', () => Unit.emit(parent, '-connect', { id: socket.id }));
    socket.on('disconnect', () => Unit.emit(parent, '-disconnect', {}));
    socket.on('notfound', (payload: any) => Unit.emit(parent, '-notfound', payload ?? {}));
    root.on('finalize', () => {
        socket.off('sync', applyStateTree); socket.off('status', onStatus); socket.disconnect();
    });
    return root;
}

//---- facade -----------------------------------------------------------------------------------------

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
