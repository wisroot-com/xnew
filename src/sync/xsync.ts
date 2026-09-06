//----------------------------------------------------------------------------------------------------
// xsync — networking layer: shared state + boot + facade (exported as `xsync`)
// The server root is the source of truth: each update it projects its registered units per connected
// client (respecting visibility) and emits that node list ('sync'); client roots only diff-apply it.
//----------------------------------------------------------------------------------------------------

import { Unit, ComponentFn, DefinesOf, PropsOf } from '../core/unit';
import { getEnvironment } from './environment';
import { RoomIO, BootOptions, ClientStatus, RoomStatus } from './roomio';

//----------------------------------------------------------------------------------------------------
// shared state — rides Unit's generic slots: the RoomIO on _.inherited, node data on _.own
//----------------------------------------------------------------------------------------------------

export interface SyncNode { id: number; name: string; parent: number | null; state: Record<string, any>; }
// visibility === null → public; otherwise a predicate re-evaluated per capture, so a closure over dynamic state can widen private → public.
interface SyncData { id: number | null; state: Record<string, any>; registry: Record<string, Function>; visibility: ((clientId: string) => boolean) | null; }

// lazily created; every caller (reader or writer) shares the one object.
export function syncData(unit: Unit): SyncData {
    return unit._.own.syncData ??= { id: null, state: {}, registry: {}, visibility: null };
}

//----------------------------------------------------------------------------------------------------
// transport
//----------------------------------------------------------------------------------------------------

// The whole wire protocol (reserved names — never use them as app `type`s); fan-out stays server-authoritative:
// a client→client message is relayed by the server, never sent socket to socket.
//   'sync'          server→client  SyncNode[]              state channel — per-client projection, emitted only when changed; the client diff-applies it, then dispatches 'sync.update'
//   'status'        server→client  { clients }             roster channel — room membership snapshot
//   'emitToServer'  client→server  { type, syncId, data, to? }  message channel — dispatch `type` on the server, or relay it to the `to` clients (xsync.emit with a target)
//   'emitToClients' server→client  { type, syncId, id, data }   message channel — dispatch `type` on the clients (also carries the lifecycle relay)
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

function dispatch(roomio: RoomIO, type: string, id: string | undefined, data: Record<string, any> = {}, syncId?: number | null): void {
    // iterate a copy: a handler may finalize units, which mutates both tables mid-dispatch
    [...(Unit.type2units.get(type) ?? [])].forEach((unit) => {
        // socket callbacks run outside the scope machinery: a message landing after / mid-finalize must not fire a dying unit's handler.
        if (unit._.phase === 'finalized' || unit._.phase === 'finalizing') return;
        if (RoomIO.of(unit) !== roomio) return; // skip units of another root
        if (type[0] === '-' && syncData(unit).id !== syncId) return; // skip units of another sync node
        [...(unit._.listeners.get(type) ?? [])].forEach((entry) => entry.execute({ id, ...data }));
    });
}

//----------------------------------------------------------------------------------------------------
// boot
//----------------------------------------------------------------------------------------------------

function bootServer(options: BootOptions, Component: Function, props?: object): Unit {
    const { room } = options;
    const roomio = new RoomIO(options, Component, props);
    const root = roomio.root;

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
    root.on('update', () => roomio.clients.forEach((client) => {
        const tree = captureStateTree(client.id);
        const json = JSON.stringify(tree);
        if (lastEmits.get(client.id) !== json) {
            lastEmits.set(client.id, json);
            roomio.emit('sync', tree, client);
        }
    }));

    //---- roster / lifecycle / message channels (per connected socket)

    roomio.on('connection', (socket: any) => {
        const query = socket.handshake?.query;
        if (query?.roomId !== room.id) return;
        socket.join(room.id);
        // lifecycle relay: socket.to excludes the sender — each client dispatches its own from its local socket events
        roomio.clients.push({ id: socket.id, name: query?.clientName ?? '' });
        dispatch(roomio, 'sync.connect', socket.id);
        socket.to(room.id).emit('emitToClients', { type: 'sync.connect', syncId: null, id: socket.id, data: {} });
        roomio.emit('status', { clients: roomio.clients });
        dispatch(roomio, 'sync.statusupdate', undefined);
        // normalize the untrusted envelope at the wire boundary; a rejected type is dropped, never dispatched
        socket.on('emitToServer', (p: any) => {
            const type = clientEventType(p?.type);
            if (type !== null) {
                const data = typeof p?.data === 'object' && p.data !== null ? p.data : {};
                const syncId = typeof p?.syncId === 'number' ? p.syncId : null;
                if (Array.isArray(p?.to)) {
                    // relay targets are attacker-controlled: keep only this room's members (another room's socket id must stay unreachable) and stamp the real sender.
                    const to = roomio.clients.filter((client) => p.to.includes(client.id));
                    if (to.length > 0) {
                        roomio.emit('emitToClients', { type, syncId, id: socket.id, data }, to);
                    }
                } else {
                    dispatch(roomio, type, socket.id, data, syncId);
                }
            }
        });
        socket.on('disconnect', () => {   // mirror of connect
            roomio.clients = roomio.clients.filter((c) => c.id !== socket.id);
            lastEmits.delete(socket.id);
            dispatch(roomio, 'sync.disconnect', socket.id);
            socket.to(room.id).emit('emitToClients', { type: 'sync.disconnect', syncId: null, id: socket.id, data: {} });
            roomio.emit('status', { clients: roomio.clients });
            dispatch(roomio, 'sync.statusupdate', undefined);
        });
    });
    return root;
}

function bootClient(options: BootOptions, Component: Function, props?: object): Unit {
    const roomio = new RoomIO(options, Component, props);
    const root = roomio.root;

    //---- state channel

    const reconcileMap = new Map<number, Unit>();   // node id → replica unit
    // duplicate-frame guard: 'sync.update' must mean an actual change, even against a server that re-emits an unchanged tree
    let lastTree = '';
    roomio.on('sync', (tree: SyncNode[]) => {
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
                const unit = new Unit(nodeParent, Component, { _own: { syncData: { id: node.id, state: { ...node.state }, registry: {}, visibility: null } } });
                reconcileMap.set(node.id, unit);
            }
            for (const [id, unit] of reconcileMap) {   // deleting the visited entry mid-iteration is spec-safe for Map
                if (!incoming.has(id)) { unit.finalize(); reconcileMap.delete(id); }
            }
            dispatch(roomio, 'sync.update', undefined);   // after reconcile, so handlers read the applied state (fresh replicas included)
        }
    });
    //---- roster channel
    roomio.on('status', (status: { clients?: ClientStatus[] }) => {
        roomio.clients = status?.clients ?? [];
        dispatch(roomio, 'sync.statusupdate', undefined);
    });

    //---- message channel (normalize the untrusted envelope at the wire boundary)
    roomio.on('emitToClients', (p: any) => {
        // the server is trusted here (it relays 'sync.connect' / 'sync.disconnect' through this channel), so only the payload shape is normalized
        if (typeof p?.type === 'string' && p.type.length > 0) {
            const data = typeof p?.data === 'object' && p.data !== null ? p.data : {};
            dispatch(roomio, p.type, p?.id, data, typeof p?.syncId === 'number' ? p.syncId : null);
        }
    });

    //---- lifecycle channel: own events dispatch from the own socket; other members' arrive via the server relay
    roomio.on('connect', () => dispatch(roomio, 'sync.connect', roomio.socket.id));
    roomio.on('disconnect', () => dispatch(roomio, 'sync.disconnect', roomio.socket.id));
    roomio.on('notfound', (payload: any) => dispatch(roomio, 'sync.notfound', roomio.socket.id, typeof payload === 'object' && payload !== null ? payload : {}));

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
        const roomio = RoomIO.of(Unit.current, true);
        return {
            get room(): RoomStatus { return roomio.room; },
            get clients(): ClientStatus[] { return roomio.clients; },
            get myself(): ClientStatus {
                if (getEnvironment() === 'server') {
                    throw new Error('xsync.session.myself is only available on the client side.');
                }
                const socket = roomio.socket;
                return roomio.clients.find((c) => c.id === socket.id) ?? { id: socket.id, name: '' };
            },
        };
    },
    // One send across client→server→client: `clients` (a ClientStatus or an array of them) is always delivered by the server — a client's targeted send is relayed, never socket to socket; omitted it means one hop (client→server / server→the whole room), and an empty array reaches nobody.
    emit(type: string, props: Record<string, any> = {}, clients?: ClientStatus | ClientStatus[]): void {
        const roomio = RoomIO.of(Unit.current, true);
        const syncId = syncData(Unit.current).id;
        const to = clients === undefined ? undefined : (Array.isArray(clients) ? clients : [clients]);
        if (to !== undefined && to.length === 0) { return; }
        if (getEnvironment() === 'server') {
            // the envelope id stays undefined (server-originated), so a relay names the original sender inside data.
            roomio.emit('emitToClients', { type, syncId, id: undefined, data: props }, to);
        } else {
            roomio.emit('emitToServer', { type, syncId, data: props, to: to?.map((client) => client.id) });
        }
    },
    // one root component only: listeners for sync.* must live inside it, so compose with xnew.extend rather than a second argument.
    boot<C extends ComponentFn<any, any>>(options: BootOptions, Component: C, props?: PropsOf<C>): Unit {
        return getEnvironment() === 'server' ? bootServer(options, Component, props) : bootClient(options, Component, props);
    },
};
