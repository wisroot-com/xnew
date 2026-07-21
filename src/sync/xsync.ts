//----------------------------------------------------------------------------------------------------
// xsync — networking layer: shared state + boot + facade (exported as `xsync`)
// The server root is the source of truth: each update it projects its registered units per connected
// client (respecting xsync.visibleTo) and emits that flat pre-order node list ('sync') to each socket
// individually; client roots only diff-apply the tree they receive into replica units.
//----------------------------------------------------------------------------------------------------

import { Unit, ComponentFn, DefinesOf, PropsOf } from '../core/unit';

let environment: 'server' | 'client' | null = null;

export function setEnvironment(env: 'server' | 'client' | null): void {
    environment = env;
}

export function getEnvironment(): 'server' | 'client' {
    return environment ?? ((typeof window === 'undefined' || typeof window.document === 'undefined') ? 'server' : 'client');
}

//----------------------------------------------------------------------------------------------------
// shared state
//----------------------------------------------------------------------------------------------------

export interface SyncNode { id: number; name: string; parent: number | null; state: Record<string, any>; }
// visibility === null → public (sent to every client); otherwise a predicate re-evaluated per capture,
// so a closure over dynamic state (e.g. a `revealed` flag) can widen a node from private to public.
interface SyncData { id: number | null; state: Record<string, any>; registry: Record<string, Function>; visibility: ((clientId: string) => boolean) | null; }

const syncData: WeakMap<Unit, SyncData> = new WeakMap();

export function syncOf(unit: Unit): SyncData {
    if (syncData.has(unit) === false) {
        syncData.set(unit, { id: null, state: {}, registry: {}, visibility: null });
    }
    return syncData.get(unit)!;
}

interface ClientStatus { id: string; name: string; }
interface RoomStatus { id: string; name: string; count: number; }

interface ServerInfo { io: any; room: RoomStatus; clients: ClientStatus[]; }
interface ClientInfo { socket: any; room: RoomStatus; clients: ClientStatus[]; }

interface BootServerOptions { io: any; room: RoomStatus; }
interface BootClientOptions { io: any; room: RoomStatus; client: any; }

// boot root → its info; descendants resolve the nearest root by walking their ancestor chain.
const rootInfos: WeakMap<Unit, ServerInfo | ClientInfo> = new WeakMap();

function findRootInfo(unit: Unit): ServerInfo | ClientInfo | undefined {
    for (let u: Unit | null = unit; u !== null; u = u._.parent) {
        if (rootInfos.has(u) === true) {
            return rootInfos.get(u);
        }
    }
    return undefined;
}

function rootInfoOf(unit: Unit): ServerInfo | ClientInfo {
    const info = findRootInfo(unit);
    if (info === undefined) {
        throw new Error('no socket bound to this root; create it with xsync.boot({ io, room } | { io, client, room }, ...).');
    }
    return info;
}

//----------------------------------------------------------------------------------------------------
// transport
//----------------------------------------------------------------------------------------------------

// Reserved wire events (never used as app `type`s). Message direction is fixed: clients may only
// reach the server (emitToServer); fan-out to clients is server-authoritative (emitToClients) — there
// is no client→client relay, so a client can never route a message to another client.
const WIRE_TO_SERVER = 'sync:toServer';   // client→server: { type, syncId, data }      → dispatch `type` on the server
const WIRE_DELIVER = 'sync:deliver';      // server→client: { type, syncId, id, data }   → dispatch `type` on the client

function dispatch(info: ServerInfo | ClientInfo, event: string, id: string | undefined, payload: any): void {
    const data = payload && payload.data !== null && typeof payload.data === 'object' ? payload.data : {};
    const syncId = payload ? payload.syncId : undefined;
    (Unit.type2units.get(event) ?? []).forEach((unit) => {
        // socket callbacks run outside the tick/scope machinery: a message landing after finalize()
        // (or mid-finalize, which Unit.scope does not guard) must not fire a dying unit's handler.
        if (unit._.phase === 'finalized' || unit._.phase === 'finalizing') return;
        if (findRootInfo(unit) !== info) return; // skip units of another root
        if (event[0] === '-' && syncOf(unit).id !== syncId) return; // skip units of another sync node
        unit._.listeners.get(event)?.forEach((item) => item.execute({ id, ...data }));
    });
}

// server→clients only; the envelope id is left undefined (server-originated), so a relaying handler
// that wants to name the original sender carries the id inside data.
function relayToClients(info: ServerInfo, type: string, syncId: number | null, data: any, ids?: string[]): void {
    const envelope = { type, syncId, id: undefined, data };
    if (Array.isArray(ids) && ids.length > 0) {
        ids.forEach((cid) => info.io.to(cid).emit(WIRE_DELIVER, envelope));   // each socket is in a room named by its id
    } else {
        info.io.to(info.room.id).emit(WIRE_DELIVER, envelope);
    }
}

//----------------------------------------------------------------------------------------------------
// boot
//----------------------------------------------------------------------------------------------------

function bootServer(opts: BootServerOptions, parent: Unit, args: any[]): Unit {
    const { io, room } = opts;
    const info: ServerInfo = { io, room, clients: [] };

    // register info before init so the body (and descendants) resolve it via findRootInfo.
    const root = new Unit(parent);
    rootInfos.set(root, info);
    Unit.initialize(root, ...args);

    // a sync target is a unit registered in its direct parent's registry; nextId is monotonic
    // across captures so a unit keeps its id for its whole lifetime.
    let nextId = 1;
    // project the registered unit tree for one client: a node declared visible only to some clients
    // (xsync.visibleTo) is skipped — together with its subtree, which would otherwise lose its parent
    // link — for any client it excludes, so private state never reaches that client's wire.
    const captureStateTree = (clientId: string): SyncNode[] => {
        const nodes: SyncNode[] = [];
        // _.Components is [base..., most-derived]; match the registered name from the tail.
        const syncName = (unit: Unit): string | undefined => {
            let name: string | undefined = undefined;
            const registry = unit._.parent ? syncData.get(unit._.parent)?.registry : undefined;
            if (registry !== undefined) {
                const names = new Map(Object.entries(registry).map(([key, Component]) => [Component, key]));
                for (let i = unit._.Components.length - 1; i >= 0 && name === undefined; i--) {
                    name = names.get(unit._.Components[i]);
                }
            }
            return name;
        };
        const walk = (unit: Unit, parent: number | null): void => {
            const name = syncName(unit);
            if (name === undefined) {
                unit._.children.forEach((child) => walk(child, parent));   // pass-through: keep the same parent id
            } else {
                const data = syncOf(unit);
                const visible = data.visibility === null || data.visibility(clientId) === true;
                if (visible === true) {
                    data.id ??= nextId++;
                    nodes.push({ id: data.id, name, parent, state: { ...data.state } });
                    unit._.children.forEach((child) => walk(child, data.id));
                }
                // else: a hidden sync node — skip it and its whole subtree for this client
            }
        };
        walk(root, null);
        return nodes;
    };

    root.on('update', () => info.clients.forEach((client) => io.to(client.id).emit('sync', captureStateTree(client.id))));
    // keep the handler so finalize can detach it — a room that dies must not leave a listener on io
    // (rooms come and go, and io's listener count would otherwise grow without bound).
    const connection = (socket: any) => {
        const query = socket.handshake?.query;
        if (query?.roomId !== room.id) return; // ignore other rooms
        socket.join(room.id);
        info.clients.push({ id: socket.id, name: query?.clientName ?? '' });
        dispatch(info, 'sync.connect', socket.id, undefined);
        statusUpdate();
        socket.onAny((event: string, payload: any) => {
            if (event === WIRE_TO_SERVER) {
                dispatch(info, payload?.type, socket.id, payload);
            }
            // no client→client relay: a client can only reach the server (WIRE_TO_SERVER).
        });
        socket.on('disconnect', () => {
            info.clients = info.clients.filter((c) => c.id !== socket.id);
            dispatch(info, 'sync.disconnect', socket.id, undefined);
            statusUpdate();
        });
    };
    io.on('connection', connection);
    root.on('finalize', () => io.off('connection', connection));
    function statusUpdate() {
        io.to(room.id).emit('status', { clients: info.clients });
        dispatch(info, 'sync.statusupdate', undefined, undefined);
    }
    return root;
}

function bootClient(opts: BootClientOptions, parent: Unit, args: any[]): Unit {
    const { io, room, client } = opts;
    // boot owns the socket; the handshake query must stay flat strings (socket.io stringifies values).
    const socket = io({ query: { roomId: room.id, clientName: client?.name ?? '' }, forceNew: true });
    const info: ClientInfo = { socket, room, clients: [] };

    const root = new Unit(parent);
    rootInfos.set(root, info);
    Unit.initialize(root, ...args);

    // diff-apply a captured tree onto this root; reconcileMap tracks node id → replica unit.
    const reconcileMap = new Map<number, Unit>();
    const applyStateTree = (tree: SyncNode[]): void => {
        const incoming = new Set<number>(tree.map((node) => node.id));
        for (const node of tree) {
            const existing = reconcileMap.get(node.id);
            if (existing !== undefined) {
                // reconcile in place (keep the object identity component bodies captured via xsync.state):
                // drop keys the authoritative state no longer has, then assign the incoming ones.
                const state = syncOf(existing).state;
                for (const key of Object.keys(state)) {
                    if ((key in node.state) === false) { delete state[key]; }
                }
                Object.assign(state, node.state);
                continue;
            }
            const nodeParent = node.parent === null ? root : reconcileMap.get(node.parent);
            const Component = nodeParent && syncOf(nodeParent).registry[node.name];
            if (!Component) { continue; }
            // seed SyncData before initialize so the body's xsync.state sees the server state and fixed id
            const unit = new Unit(nodeParent);
            syncData.set(unit, { id: node.id, state: { ...node.state }, registry: {}, visibility: null });
            Unit.initialize(unit, Component);
            reconcileMap.set(node.id, unit);
        }
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
        if (event === WIRE_DELIVER) { dispatch(info, payload?.type, payload?.id, payload); }
    });

    // forward the socket's own lifecycle to the host unit (boot parent) as local '-events'.
    socket.on('connect', () => Unit.emit(parent, '-connect', { id: socket.id }));
    socket.on('disconnect', () => Unit.emit(parent, '-disconnect', {}));
    socket.on('notfound', (payload: any) => Unit.emit(parent, '-notfound', payload ?? {}));
    root.on('finalize', () => {
        socket.off('sync', applyStateTree); socket.off('status', onStatus); socket.disconnect();
    });
    return root;
}

//----------------------------------------------------------------------------------------------------
// facade
//----------------------------------------------------------------------------------------------------

export const xsync = {
    server<C extends ComponentFn<any, any>>(callback: C, props?: PropsOf<C>): DefinesOf<C> | {} {
        return getEnvironment() === 'server' ? Unit.extend(Unit.current, callback, props) as DefinesOf<C> : {};
    },
    client<C extends ComponentFn<any, any>>(callback: C, props?: PropsOf<C>): DefinesOf<C> | {} {
        return getEnvironment() === 'client' ? Unit.extend(Unit.current, callback, props) as DefinesOf<C> : {};
    },
    state(initial: Record<string, any> = {}): Record<string, any> {
        const data = syncOf(Unit.current);
        for (const key of Object.keys(initial)) {
            if (!(key in data.state)) { data.state[key] = initial[key]; }
        }
        return data.state;
    },
    register(Components: Record<string, Function>): void {
        const unit = Unit.current;
        if (unit._.phase !== 'invoked') {
            throw new Error('xsync.register must be called during component initialization.');
        }
        Object.assign(syncOf(unit).registry, Components);
    },
    // Restrict this sync node (and its subtree) to the given client(s): a client id, a list of ids, or a
    // predicate re-evaluated on every capture. Pass null to make it public again. Unset ⇒ public. The
    // predicate form is the way to reveal dynamically — close over a flag and flip it (see examples).
    visibleTo(target: string | string[] | ((clientId: string) => boolean) | null): void {
        const data = syncOf(Unit.current);
        if (target === null) {
            data.visibility = null;
        } else if (typeof target === 'function') {
            data.visibility = target;
        } else if (Array.isArray(target)) {
            const allowed = new Set(target);
            data.visibility = (clientId) => allowed.has(clientId);
        } else {
            data.visibility = (clientId) => clientId === target;
        }
    },
    get session(): { room: RoomStatus; clients: ClientStatus[]; myself: ClientStatus } {
        const info = rootInfoOf(Unit.current);
        const isServer = getEnvironment() === 'server';
        return {
            get room(): RoomStatus { return info.room; },
            get clients(): ClientStatus[] { return info.clients; },
            get myself(): ClientStatus {
                if (isServer) {
                    throw new Error('xsync.session.myself is only available on the client side.');
                }
                const client = info as ClientInfo;
                return client.clients.find((c) => c.id === client.socket.id) ?? { id: client.socket.id, name: '' };
            },
        };
    },
    emitToServer(type: string, props: Record<string, any> = {}): void {
        const info = rootInfoOf(Unit.current);
        if (getEnvironment() === 'server') {
            Unit.emit(Unit.current, type, props);
        } else {
            (info as ClientInfo).socket.emit(WIRE_TO_SERVER, { type, syncId: syncOf(Unit.current).id, data: props });
        }
    },
    // server→clients only. Clients cannot fan out to other clients; from a client, emit to the server
    // (emitToServer) and let a server handler relay via emitToClients.
    emitToClients(type: string, props: Record<string, any> = {}, ids?: string[]): void {
        if (getEnvironment() !== 'server') {
            throw new Error('xsync.emitToClients is server-only; from a client use xsync.emitToServer and relay from a server handler.');
        }
        const info = rootInfoOf(Unit.current);
        const syncId = syncOf(Unit.current).id;
        relayToClients(info as ServerInfo, type, syncId, props, ids);
    },
    boot(opts: BootServerOptions | BootClientOptions, ...args: any[]): Unit {
        if (getEnvironment() === 'server') {
            return bootServer(opts as BootServerOptions, Unit.current, args);
        } else {
            return bootClient(opts as BootClientOptions, Unit.current, args);
        }
    },
};
