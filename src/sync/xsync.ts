//----------------------------------------------------------------------------------------------------
// xsync — networking layer: shared state + boot + facade (exported as `xsync`)
// The server root is the source of truth: each update it projects its registered units per connected
// client (respecting visibility) and emits that node list ('sync'); client roots only diff-apply it.
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

interface BootOptions { io: any; room: RoomStatus; client?: any; }   // client is client-boot only

// boot puts its root object on inherited.syncRoot, so every descendant carries it from construction.
function syncRoot(unit: Unit, required?: true): ServerRoot | ClientRoot | null {
    const root = unit._.inherited.syncRoot ?? null;
    if (required === true && root === null) {
        throw new Error('no socket bound to this root; create it with xsync.boot({ io, room } | { io, client, room }, ...).');
    }
    return root;
}

// lazily created; every caller (reader or writer) shares the one object.
export function syncData(unit: Unit): SyncData {
    return unit._.own.syncData ??= { id: null, state: {}, registry: {}, visibility: null };
}

//----------------------------------------------------------------------------------------------------
// transport
//----------------------------------------------------------------------------------------------------

// The whole wire protocol (reserved names — never use them as app `type`s); fan-out is server-authoritative, no client→client relay:
//   'sync'          server→client  SyncNode[]              state channel — per-client projection, emitted only when changed; the client diff-applies it, then dispatches 'sync.update'
//   'status'        server→client  { clients }             roster channel — room membership snapshot
//   'emitToServer'  client→server  { type, syncId, data }  message channel — dispatch `type` on the server
//   'emitToClients' server→client  { type, syncId, id, data }  message channel — dispatch `type` on the clients (also carries the lifecycle relay)
//   connect / disconnect / notfound (socket-native)        lifecycle channel — dispatched as 'sync.connect' / 'sync.disconnect' / 'sync.notfound'

// 'sync.' is the library's own namespace: only bootServer / bootClient may dispatch it, never a client envelope.
const RESERVED_PREFIX = 'sync.';

// A client envelope is attacker-controlled, so its type is checked before it can reach any listener; the server relay is trusted and keeps the reserved namespace.
function clientEventType(type: unknown): string | null {
    if (typeof type === 'string' && type.length > 0 && type.startsWith(RESERVED_PREFIX) === false) {
        return type;
    } else {
        return null;
    }
}

function dispatch(info: ServerRoot | ClientRoot, type: string, id: string | undefined, data: Record<string, any> = {}, syncId?: number | null): void {
    // iterate a copy: a handler may finalize units, which mutates both tables mid-dispatch
    [...(Unit.type2units.get(type) ?? [])].forEach((unit) => {
        // socket callbacks run outside the scope machinery: a message landing after / mid-finalize must not fire a dying unit's handler.
        if (unit._.phase === 'finalized' || unit._.phase === 'finalizing') return;
        if (syncRoot(unit) !== info) return; // skip units of another root
        if (type[0] === '-' && syncData(unit).id !== syncId) return; // skip units of another sync node
        [...(unit._.listeners.get(type) ?? [])].forEach((entry) => entry.execute({ id, ...data }));
    });
}

//----------------------------------------------------------------------------------------------------
// boot
//----------------------------------------------------------------------------------------------------

function bootServer(options: BootOptions, args: any[]): Unit {
    const { io, room } = options;
    const info: ServerRoot = { io, room, clients: [] };

    const root = new Unit({ parent: Unit.current, inherited: { syncRoot: info } }, ...args);

    //---- state channel

    // a sync target is a unit registered in its direct parent's registry; nextId is monotonic so a unit keeps its id for life.
    let nextId = 1;
    // a node hidden from the client (visibility) is skipped with its whole subtree, so private state never reaches that client's wire.
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
            }
        };
        walk(root, null);
        return nodes;
    };

    // emit only when the client's projection changed — the wire goes quiet between changes, so each delivery means "changed" on the client.
    const lastEmits = new Map<string, string>();
    root.on('update', () => info.clients.forEach((client) => {
        const tree = captureStateTree(client.id);
        const json = JSON.stringify(tree);
        if (lastEmits.get(client.id) !== json) {
            lastEmits.set(client.id, json);
            io.to(client.id).emit('sync', tree);
        }
    }));

    //---- roster / lifecycle / message channels (per connected socket)

    // keep the handler so finalize can detach it — a dead room must not leave a listener on io (its count would grow without bound).
    const connection = (socket: any) => {
        const query = socket.handshake?.query;
        if (query?.roomId !== room.id) return;
        socket.join(room.id);
        // lifecycle relay: socket.to excludes the sender — each client dispatches its own from its local socket events
        info.clients.push({ id: socket.id, name: query?.clientName ?? '' });
        dispatch(info, 'sync.connect', socket.id);
        socket.to(room.id).emit('emitToClients', { type: 'sync.connect', syncId: null, id: socket.id, data: {} });
        io.to(room.id).emit('status', { clients: info.clients });
        dispatch(info, 'sync.statusupdate', undefined);
        // normalize the untrusted envelope at the wire boundary; a rejected type is dropped, never dispatched
        socket.on('emitToServer', (p: any) => {
            const type = clientEventType(p?.type);
            if (type !== null) {
                const data = typeof p?.data === 'object' && p.data !== null ? p.data : {};
                dispatch(info, type, socket.id, data, typeof p?.syncId === 'number' ? p.syncId : null);
            }
        });
        socket.on('disconnect', () => {   // mirror of connect
            info.clients = info.clients.filter((c) => c.id !== socket.id);
            lastEmits.delete(socket.id);
            dispatch(info, 'sync.disconnect', socket.id);
            socket.to(room.id).emit('emitToClients', { type: 'sync.disconnect', syncId: null, id: socket.id, data: {} });
            io.to(room.id).emit('status', { clients: info.clients });
            dispatch(info, 'sync.statusupdate', undefined);
        });
    };
    io.on('connection', connection);
    root.on('finalize', () => io.off('connection', connection));
    return root;
}

function bootClient(options: BootOptions, args: any[]): Unit {
    const { io, room, client } = options;
    // boot owns the socket; the handshake query must stay flat strings (socket.io stringifies values).
    const socket = io({ query: { roomId: room.id, clientName: client?.name ?? '' }, forceNew: true });
    const info: ClientRoot = { socket, room, clients: [] };

    const root = new Unit({ parent: Unit.current, inherited: { syncRoot: info } }, ...args);

    //---- state channel

    const reconcileMap = new Map<number, Unit>();   // node id → replica unit
    // duplicate-frame guard: 'sync.update' must mean an actual change, even against a server that re-emits an unchanged tree
    let lastTree = '';
    socket.on('sync', (tree: SyncNode[]) => {
        const json = JSON.stringify(tree);
        if (json !== lastTree) {
            lastTree = json;
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
            dispatch(info, 'sync.update', undefined);   // after reconcile, so handlers read the applied state (fresh replicas included)
        }
    });
    //---- roster channel
    socket.on('status', (status: { clients?: ClientStatus[] }) => {
        info.clients = status?.clients ?? [];
        dispatch(info, 'sync.statusupdate', undefined);
    });

    //---- message channel (normalize the untrusted envelope at the wire boundary)
    socket.on('emitToClients', (p: any) => {
        // the server is trusted here (it relays 'sync.connect' / 'sync.disconnect' through this channel), so only the payload shape is normalized
        if (typeof p?.type === 'string' && p.type.length > 0) {
            const data = typeof p?.data === 'object' && p.data !== null ? p.data : {};
            dispatch(info, p.type, p?.id, data, typeof p?.syncId === 'number' ? p.syncId : null);
        }
    });

    //---- lifecycle channel: own events dispatch from the own socket; other members' arrive via the server relay
    socket.on('connect', () => dispatch(info, 'sync.connect', socket.id));
    socket.on('disconnect', () => dispatch(info, 'sync.disconnect', socket.id));
    socket.on('notfound', (payload: any) => dispatch(info, 'sync.notfound', socket.id, typeof payload === 'object' && payload !== null ? payload : {}));

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
    // Restrict this sync node (and its subtree) with a predicate re-evaluated per capture (the way to reveal dynamically); null ⇒ public again.
    visibility(target: ((clientId: string) => boolean) | null): void {
        syncData(Unit.current).visibility = target;
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
            (info as ClientRoot).socket.emit('emitToServer', { type, syncId: syncData(Unit.current).id, data: props });
        }
    },
    emitToClients(type: string, props: Record<string, any> = {}, ids?: string[]): void {
        if (getEnvironment() !== 'server') {
            throw new Error('xsync.emitToClients is server-only; from a client use xsync.emitToServer and relay from a server handler.');
        }
        const { io, room } = syncRoot(Unit.current, true) as ServerRoot;
        // the envelope id stays undefined (server-originated), so a relay names the original sender inside data.
        const envelope = { type, syncId: syncData(Unit.current).id, id: undefined, data: props };
        // each socket is in a room named by its id, so individual and room-wide delivery share io.to()
        (ids?.length ? ids : [room.id]).forEach((target) => io.to(target).emit('emitToClients', envelope));
    },
    boot(options: BootOptions, ...args: any[]): Unit {
        return getEnvironment() === 'server' ? bootServer(options, args) : bootClient(options, args);
    },
};
