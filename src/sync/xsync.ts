//----------------------------------------------------------------------------------------------------
// xsync — networking layer: shared state + boot + facade (exported as `xsync`)
// The server root is the source of truth: each update it projects its registered units per connected
// client (respecting visibleTo) and emits that node list ('sync'); client roots only diff-apply it.
//----------------------------------------------------------------------------------------------------

import { Unit, ComponentFn, DefinesOf, PropsOf } from '../core/unit';
import { getEnvironment } from './environment';

//----------------------------------------------------------------------------------------------------
// shared state — rides Unit's generic slots: the root object on _.inherited, node data on _.own
//----------------------------------------------------------------------------------------------------

export interface SyncNode { id: number; name: string; parent: number | null; state: Record<string, any>; }
// visibility === null → public; otherwise a predicate re-evaluated per capture, so a closure over dynamic state can widen private → public.
interface SyncData { id: number | null; state: Record<string, any>; registry: Record<string, Function>; visibility: ((clientId: string) => boolean) | null; }

interface ClientStatus { id: string; name: string; }
interface RoomStatus { id: string; name: string; count: number; }

interface ServerRoot { io: any; room: RoomStatus; clients: ClientStatus[]; }
interface ClientRoot { socket: any; room: RoomStatus; clients: ClientStatus[]; }

interface BootOptions { io: any; room: RoomStatus; client?: any; }   // client is client-boot only; a server boot ignores it

// boot puts its root object on inherited.syncRoot, so every descendant carries it from construction; required ⇒ throw instead of null.
function syncRoot(unit: Unit, required?: true): ServerRoot | ClientRoot | null {
    const root = unit._.inherited.syncRoot ?? null;
    if (required === true && root === null) {
        throw new Error('no socket bound to this root; create it with xsync.boot({ io, room } | { io, client, room }, ...).');
    }
    return root;
}

// per-unit sync node data on own.syncData, created lazily so every caller (reader or writer) shares the one object.
export function syncData(unit: Unit): SyncData {
    return unit._.own.syncData ??= { id: null, state: {}, registry: {}, visibility: null };
}

//----------------------------------------------------------------------------------------------------
// transport
//----------------------------------------------------------------------------------------------------

// Reserved wire events (never used as app `type`s); direction is fixed: clients reach only the server, fan-out is server-authoritative — no client→client relay.
const WIRE_TO_SERVER = 'sync:toServer';   // client→server: { type, syncId, data }      → dispatch `type` on the server
const WIRE_DELIVER = 'sync:deliver';      // server→client: { type, syncId, id, data }   → dispatch `type` on the client

function dispatch(info: ServerRoot | ClientRoot, event: string, id: string | undefined, payload: any): void {
    const data = typeof payload?.data === 'object' && payload.data !== null ? payload.data : {};
    const syncId = payload?.syncId;
    (Unit.type2units.get(event) ?? []).forEach((unit) => {
        // socket callbacks run outside the scope machinery: a message landing after / mid-finalize must not fire a dying unit's handler.
        if (unit._.phase === 'finalized' || unit._.phase === 'finalizing') return;
        if (syncRoot(unit) !== info) return; // skip units of another root
        if (event[0] === '-' && syncData(unit).id !== syncId) return; // skip units of another sync node
        unit._.listeners.get(event)?.forEach((item) => item.execute({ id, ...data }));
    });
}

//----------------------------------------------------------------------------------------------------
// boot
//----------------------------------------------------------------------------------------------------

function bootServer(opts: BootOptions, args: any[]): Unit {
    const { io, room } = opts;
    const info: ServerRoot = { io, room, clients: [] };

    const root = new Unit({ parent: Unit.current, inherited: { syncRoot: info } }, ...args);

    // a sync target is a unit registered in its direct parent's registry; nextId is monotonic so a unit keeps its id for life.
    let nextId = 1;
    // project the registered unit tree for one client: a node hidden from it (visibleTo) is skipped together with its whole subtree, so private state never reaches that client's wire.
    const captureStateTree = (clientId: string): SyncNode[] => {
        const nodes: SyncNode[] = [];
        const walk = (unit: Unit, parent: number | null): void => {
            // _.Components is [base..., most-derived]; match the registered name from the tail.
            let name: string | undefined = undefined;
            const registry = unit._.parent?._.own.syncData?.registry;
            if (registry !== undefined) {
                for (let i = unit._.Components.length - 1; i >= 0 && name === undefined; i--) {
                    name = Object.keys(registry).find((key) => registry[key] === unit._.Components[i]);
                }
            }
            if (name === undefined) {
                unit._.children.forEach((child) => walk(child, parent));   // pass-through: keep the same parent id
            } else {
                const data = syncData(unit);
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
    // keep the handler so finalize can detach it — a dead room must not leave a listener on io (its count would grow without bound).
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

function bootClient(opts: BootOptions, args: any[]): Unit {
    const parent = Unit.current;   // captured once: the socket lifecycle forwards below must reach the boot-time host
    const { io, room, client } = opts;
    // boot owns the socket; the handshake query must stay flat strings (socket.io stringifies values).
    const socket = io({ query: { roomId: room.id, clientName: client?.name ?? '' }, forceNew: true });
    const info: ClientRoot = { socket, room, clients: [] };

    const root = new Unit({ parent, inherited: { syncRoot: info } }, ...args);

    // diff-apply each captured tree onto this root; reconcileMap tracks node id → replica unit.
    const reconcileMap = new Map<number, Unit>();
    socket.on('sync', (tree: SyncNode[]) => {
        const incoming = new Set<number>(tree.map((node) => node.id));
        for (const node of tree) {
            const existing = reconcileMap.get(node.id);
            if (existing !== undefined) {
                // reconcile in place (keep the identity bodies captured via xsync.state): drop stale keys, then assign the incoming ones.
                const state = syncData(existing).state;
                for (const key of Object.keys(state)) {
                    if ((key in node.state) === false) { delete state[key]; }
                }
                Object.assign(state, node.state);
                continue;
            }
            const nodeParent = node.parent === null ? root : reconcileMap.get(node.parent);
            const Component = nodeParent && syncData(nodeParent).registry[node.name];
            if (!Component) { continue; }
            // seed syncData at construction so the body's xsync.state sees the server state and fixed id
            const unit = new Unit({ parent: nodeParent, own: { syncData: { id: node.id, state: { ...node.state }, registry: {}, visibility: null } } }, Component);
            reconcileMap.set(node.id, unit);
        }
        for (const [id, unit] of reconcileMap) {   // deleting the visited entry mid-iteration is spec-safe for Map
            if (!incoming.has(id)) { unit.finalize(); reconcileMap.delete(id); }
        }
    });
    socket.on('status', (status: { clients?: ClientStatus[] }) => {
        info.clients = status?.clients ?? [];
        dispatch(info, 'sync.statusupdate', undefined, undefined);
    });
    socket.onAny((event: string, payload: any) => {
        if (event === WIRE_DELIVER) { dispatch(info, payload?.type, payload?.id, payload); }
    });

    // forward the socket's own lifecycle to the host unit (boot parent) as local '-events'.
    socket.on('connect', () => Unit.emit(parent, '-connect', { id: socket.id }));
    socket.on('disconnect', () => Unit.emit(parent, '-disconnect', {}));
    socket.on('notfound', (payload: any) => Unit.emit(parent, '-notfound', payload ?? {}));
    root.on('finalize', () => socket.disconnect());
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
        const data = syncData(Unit.current);
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
        Object.assign(syncData(unit).registry, Components);
    },
    // Restrict this sync node (and its subtree) to the given client(s): an id, a list, or a predicate re-evaluated per capture (the way to reveal dynamically); null ⇒ public again.
    visibleTo(target: string | string[] | ((clientId: string) => boolean) | null): void {
        const data = syncData(Unit.current);
        if (target === null || typeof target === 'function') {
            data.visibility = target;
        } else {
            const allowed = new Set([target].flat());
            data.visibility = (clientId) => allowed.has(clientId);
        }
    },
    get session(): { room: RoomStatus; clients: ClientStatus[]; myself: ClientStatus } {
        const info = syncRoot(Unit.current, true) as ServerRoot | ClientRoot;
        return {
            get room(): RoomStatus { return info.room; },
            get clients(): ClientStatus[] { return info.clients; },
            get myself(): ClientStatus {
                if (getEnvironment() === 'server') {
                    throw new Error('xsync.session.myself is only available on the client side.');
                }
                const client = info as ClientRoot;
                return client.clients.find((c) => c.id === client.socket.id) ?? { id: client.socket.id, name: '' };
            },
        };
    },
    emitToServer(type: string, props: Record<string, any> = {}): void {
        const info = syncRoot(Unit.current, true) as ServerRoot | ClientRoot;
        if (getEnvironment() === 'server') {
            Unit.emit(Unit.current, type, props);
        } else {
            (info as ClientRoot).socket.emit(WIRE_TO_SERVER, { type, syncId: syncData(Unit.current).id, data: props });
        }
    },
    // server→clients only; from a client, emitToServer and let a server handler relay via emitToClients.
    emitToClients(type: string, props: Record<string, any> = {}, ids?: string[]): void {
        if (getEnvironment() !== 'server') {
            throw new Error('xsync.emitToClients is server-only; from a client use xsync.emitToServer and relay from a server handler.');
        }
        const { io, room } = syncRoot(Unit.current, true) as ServerRoot;
        // the envelope id stays undefined (server-originated), so a relay names the original sender inside data.
        const envelope = { type, syncId: syncData(Unit.current).id, id: undefined, data: props };
        // each socket is in a room named by its id, so individual and room-wide delivery share io.to()
        (ids?.length ? ids : [room.id]).forEach((target) => io.to(target).emit(WIRE_DELIVER, envelope));
    },
    boot(opts: BootOptions, ...args: any[]): Unit {
        return getEnvironment() === 'server' ? bootServer(opts, args) : bootClient(opts, args);
    },
};
