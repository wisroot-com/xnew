//----------------------------------------------------------------------------------------------------
// sync/engine — the server↔client sync engine (environment + shared state + transport + boot)
//
// Layered internally: runtime environment (server/client detection) → shared state (syncOf / SyncInfo
// context) → transport (dispatch / relay / wire) → boot wiring (bootServer / bootClient). server/client
// is a networking distinction, so its single source lives here. The server root is the source of truth:
// on each update it captures its sync targets as a flat pre-order node list and emits 'sync'; each client
// root diff-applies that tree. A sync target is a unit whose type is registered in its parent registry.
//
// This module owns no user-facing surface: the xsync.* facade (server / client / state / register /
// emitTo* / room / clients / myself / boot) is assembled in sync/xsync.ts from the primitives exported
// here — getEnvironment, syncOf, rootInfoOf, relayToClients, bootServer / bootClient, and the WIRE_* tags.
//
// Invariants: node ids are monotonic per server root (`nextId`), so a unit keeps its id for life;
// capture runs on the root's own update (fires AFTER children update → sees this tick's mutations).
// captureStateTree / applyStateTree are boot-internal closures over `root`; drive them only through
// the 'sync' emit/apply seam.
//
// syncOf is also a test seam (replicas' per-unit sync data).
//----------------------------------------------------------------------------------------------------

import { Unit } from '../core/unit';

//---- runtime environment ----------------------------------------------------------------------------
//
// server = Node.js / client = browser. The distinction is fixed by which runtime the process is in
// (a Node process is always server, a browser tab always client), so it is decided once at load and
// never re-evaluated. xsync.server / xsync.client and the boot transport choice all share this one
// source. A temporary override exists for tests that must fake both runtimes in one process and for
// operations whose runtime is unambiguous (e.g. apply is always a client-side construction).
export type Environment = 'server' | 'client';

// window（と document）が無ければ Node.js = server、有れば browser = client。
const detectedEnvironment: Environment =
    (typeof window === 'undefined' || typeof window.document === 'undefined') ? 'server' : 'client';

let environmentOverride: Environment | null = null;

/** 現在の実行環境を返す（override 優先、無ければ起動時の自動判定）。 */
export function getEnvironment(): Environment {
    return environmentOverride ?? detectedEnvironment;
}

/** 実行環境を上書きする（null で自動判定へ戻す）。主にテストが 1 プロセスで両環境を模すために使う。 */
export function setEnvironment(env: Environment | null): void {
    environmentOverride = env;
}

/** fn 実行中だけ env へ上書きし、終了時に直前の状態へ戻す（ネスト可。例: apply は常に client 文脈で構築）。 */
export function withEnvironment<T>(env: Environment, fn: () => T): T {
    const previous = environmentOverride;
    environmentOverride = env;
    try {
        return fn();
    } finally {
        environmentOverride = previous;
    }
}

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

// 公開型。ファサードのシグネチャ（boot / room / clients / myself）経由で d.ts に露出し、
// 呼び出し側は推論で受け取る。名前付きエイリアスは公開しない。
export interface SyncClientStatus { id: string; name: string; }
export interface SyncRoomStatus { id: string; name: string; count: number; }

export interface ServerInfo { io: any; room: SyncRoomStatus; clients: SyncClientStatus[]; }
export interface ClientInfo { socket: any; room: SyncRoomStatus; clients: SyncClientStatus[]; }

export interface SyncBootServerOptions { io: any; room: SyncRoomStatus; }
export interface SyncBootClientOptions { io: any; room: SyncRoomStatus; client: any; }

// A boot root publishes its SyncInfo as an ancestor context; descendants resolve the nearest root via
// Unit.getContext. Private Symbol (avoids xnew.context() collision); auto-cleared on root finalize.
const SYNC_KEY = Symbol('sync');

/** Internal info of the caller's sync root (throws if not booted). */
export function rootInfoOf(unit: Unit): ServerInfo | ClientInfo {
    const info = Unit.getContext(unit, SYNC_KEY) as ServerInfo | ClientInfo | undefined;
    if (info === undefined) {
        throw new Error('no socket bound to this root; create it with xsync.boot({ io, room } | { io, client, room }, ...).');
    }
    return info;
}

//---- transport --------------------------------------------------------------------------------------

// Reserved wire events for emitToServer / emitToClient (never used as app `type`s).
export const WIRE_TO_SERVER = 'sync:toServer';   // client→server: { type, syncId, data }      → dispatch `type` on the server
export const WIRE_TO_CLIENT = 'sync:toClient';   // client→server: { type, syncId, data, ids } → server fans out to clients
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
export function relayToClients(info: ServerInfo, type: string, senderId: string | undefined, syncId: number | null, data: any, ids?: string[]): void {
    const envelope = { type, syncId, id: senderId, data };
    if (Array.isArray(ids) && ids.length > 0) {
        ids.forEach((cid) => info.io.to(cid).emit(WIRE_DELIVER, envelope));   // each socket is in a room named by its id
    } else {
        info.io.to(info.room.id).emit(WIRE_DELIVER, envelope);
    }
}

//---- boot -------------------------------------------------------------------------------------------

export function bootServer(opts: SyncBootServerOptions, parent: Unit, args: any[]): Unit {
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

export function bootClient(opts: SyncBootClientOptions, parent: Unit, args: any[]): Unit {
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
    const onStatus = (status: { clients?: SyncClientStatus[] }) => {
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
