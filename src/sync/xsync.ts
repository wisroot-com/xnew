//----------------------------------------------------------------------------------------------------
// sync — the networking layer (exported as xsync): sync engine + ready-made components + facade
//
// One file, layered top→bottom: runtime environment (server/client) → shared state (syncOf / SyncInfo
// context) → transport (dispatch / relay / wire) → boot wiring (bootServer / bootClient) → the xsync.*
// facade → the ready-made Lobby / Room components → the xsync assembly. The server root is the source of
// truth: on each update it captures its sync targets as a flat pre-order node list and emits 'sync';
// each client root diff-applies that tree. A sync target is a unit whose type is registered in its
// parent registry. server/client is a networking distinction, so its single source lives here.
//
// The public barrel (src/index.ts) re-exports `xsync` from here; addons never touch these internals.
//
// - xsync : `sync` (server / client / state / register / emitTo* / room / clients / myself / boot)
//           merged with the Lobby / Room components. Callers rely on TS inference from the method
//           signatures; no named public type aliases are exported.
//
// Invariants: node ids are monotonic per server root (`nextId`), so a unit keeps its id for life;
// capture runs on the root's own update (fires AFTER children update → sees this tick's mutations).
// captureStateTree / applyStateTree are boot-internal closures over `root`; drive them only through
// the 'sync' emit/apply seam.
//
// Caveat: xsync copies the facade via getOwnPropertyDescriptors, NOT Object.assign — room / clients /
// myself are getters that resolve the current unit lazily, and Object.assign would invoke them at
// module load (no current unit → throw). defineProperties drops the facade type from its return, so
// the result is cast back.
//
// syncOf is also a test seam (replicas' per-unit sync data); setEnvironment / withEnvironment let tests
// fake both runtimes in one process.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../core/xnew';
import { Unit, UnitTimer, ComponentFn, DefinesOf, PropsOf } from '../core/unit';

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
interface SyncClientStatus { id: string; name: string; }
interface SyncRoomStatus { id: string; name: string; count: number; }

interface ServerInfo { io: any; room: SyncRoomStatus; clients: SyncClientStatus[]; }
interface ClientInfo { socket: any; room: SyncRoomStatus; clients: SyncClientStatus[]; }

interface SyncBootServerOptions { io: any; room: SyncRoomStatus; }
interface SyncBootClientOptions { io: any; room: SyncRoomStatus; client: any; }

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

function bootServer(opts: SyncBootServerOptions, parent: Unit, args: any[]): Unit {
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

function bootClient(opts: SyncBootClientOptions, parent: Unit, args: any[]): Unit {
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

//---- venue: ready-made "gathering place" components -------------------------------------------------
//
// Wire socket.io to the host unit; server/client auto-detected. Both sides receive io: the server
// uses it as the hub; the client calls io() to create its own socket — Lobby creates it inline,
// Room hands io (+ client) to xsync.boot which creates/owns it. The room ledger (id → Room unit) is
// module-global so Room self-removes/re-broadcasts without a Lobby context; Lobby is its sole writer
// and clears it on finalize. Scene navigation (change/add) is the caller's concern.
//
// A room-list row is SyncRoomStatus { id, name, count } (count = live member count).

const rooms = new Map<string, Unit>();

function roomList(): SyncRoomStatus[] {
    return [...rooms.values()].map((room) => room.status());
}

function broadcastRooms(io: any): void {
    io.to('lobby').emit('statusupdate', { rooms: roomList() });
}

export function Lobby(unit: Unit, props: any) {

    sync.server(() => {
        const { io, Room, maxRooms = 20, roomNameMax = 16 } = props as { io: any; Room: Function; maxRooms?: number; roomNameMax?: number; };
        let nextRoomNum = 0;

        const connection = xnew.scope((conn: any) => {
            const roomId = conn.handshake?.query?.roomId;
            if (roomId !== undefined && roomId !== '') {
                // reject gone/invalid rooms (valid ones are handled by Room's boot wiring).
                if (!rooms.has(roomId)) { conn.emit('notfound', { roomId }); conn.disconnect(true); }
                return;
            }

            conn.join('lobby');
            conn.emit('statusupdate', { rooms: roomList() });
            conn.on('roomcreate', xnew.scope((payload: any) => {
                if (rooms.size >= maxRooms) { conn.emit('roomrejected', { message: 'room limit reached' }); return; }
                const id = `r${++nextRoomNum}`;
                const name = String(payload?.name ?? '').trim().slice(0, roomNameMax) || `Room ${nextRoomNum}`;
                const room = { id, name, count: 0 };
                rooms.set(id, xnew(unit, Room, { io, room }));
                conn.emit('roomcreated', { room });
                broadcastRooms(io);
            }));
        });
        io.on('connection', connection);
        unit.on('finalize', () => { io.off('connection', connection); rooms.clear(); });
    });

    sync.client(() => {
        const { io } = props as { io: any; };
        // ロビー接続は room を持たない（query なし → server はロビー接続として扱う）。socket は Lobby が所有する。
        const socket = io({ forceNew: true });

        // 受信イベントを host の '-event' へ転送する（connect/disconnect は payload なし → {}）。
        for (const event of ['connect', 'disconnect', 'statusupdate', 'roomcreated', 'roomrejected']) {
            socket.on(event, xnew.scope((payload: any) => xnew.emit('-' + event, payload ?? {})));
        }
        unit.on('finalize', () => socket.disconnect());
        return { createRoom(name: string) { socket.emit('roomcreate', { name }); } };
    });
}

export function Room(unit: Unit, props: any) {
    const members = new Set<string>();

    sync.server(() => {
        const { io, room, Component, graceMs = 3000 } = props as { io: any; room: SyncBootServerOptions['room']; Component: Function; graceMs?: number; };
        sync.boot({ io, room }, Component);

        let graceTimer: UnitTimer | null = null;

        // socket.io の connection / disconnect を直接受けてこの room のメンバを計数する（room フィルタ付き）。
        const connection = xnew.scope((socket: any) => {
            if (socket.handshake?.query?.roomId !== room.id) { return; }   // 別ルームは無視
            graceTimer?.clear();
            members.add(socket.id);
            room.count = members.size;
            xnew.emit('-connect', { id: socket.id });
            if (rooms.has(room.id)) { broadcastRooms(io); }
            socket.on('disconnect', xnew.scope(() => {
                members.delete(socket.id);
                room.count = members.size;
                xnew.emit('-disconnect', { id: socket.id });
                if (rooms.has(room.id)) { broadcastRooms(io); }
                if (members.size === 0) { scheduleCleanup(); }
            }));
        });
        io.on('connection', connection);
        unit.on('finalize', () => io.off('connection', connection));

        scheduleCleanup();
        function scheduleCleanup() {
            graceTimer?.clear();
            graceTimer = xnew.timeout(() => {
                if (members.size > 0) { return; }
                xnew.emit('-empty', {});
                if (rooms.has(room.id)) { rooms.delete(room.id); broadcastRooms(io); unit.finalize(); }
            }, graceMs);
        }

        return {
            status(): SyncRoomStatus { return room; },
        };
    });

    sync.client(() => {
        const { io, client, room, Component } = props as { io: any; client: any; room: SyncRoomStatus; Component: Function; };
        sync.boot({ io, client, room }, Component);
    });
}

//---- xsync assembly ---------------------------------------------------------------------------------

export const xsync = Object.defineProperties(
    { Lobby, Room },
    Object.getOwnPropertyDescriptors(sync),
) as typeof sync & { Lobby: typeof Lobby; Room: typeof Room };
