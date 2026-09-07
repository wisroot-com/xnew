//----------------------------------------------------------------------------------------------------
// boot — the channel wiring behind xsync.boot: it hangs the state / roster / message / lifecycle
// channels onto a RoomIO. The server root is the source of truth: each update it projects its
// registered units per connected client (respecting visibility) and emits that node list ('sync').
//----------------------------------------------------------------------------------------------------

import { Unit, ComponentFn, PropsOf } from '../core/unit';
import { getSide } from './side';
import { RoomIO, BootOptions, ClientStatus } from './roomio';

//----------------------------------------------------------------------------------------------------
// transport
//----------------------------------------------------------------------------------------------------

// one captured unit on the wire — the projection of its _.sync record (a hidden node is dropped with its whole subtree).
export interface SyncNode { id: number; name: string; parent: number | null; state: Record<string, any>; }

// The whole wire protocol (reserved names — never use them as app `type`s); fan-out stays server-authoritative:
// a client→client message is relayed by the server, never sent socket to socket.
//   'sync'          server→client  SyncNode[]              state channel — per-client projection, emitted only when changed; the client diff-applies it, then dispatches 'sync.update'
//   'status'        server→client  { clients }             roster channel — room membership snapshot
//   'emitToServer'  client→server  { type, syncId, data, to? }  message channel — dispatch `type` on the server, or relay it to the `to` clients (xsync.emit with a target)
//   'emitToClients' server→client  { type, syncId, id, data }   message channel — dispatch `type` on the clients (also carries the lifecycle relay)
//   connect / disconnect / notfound (socket-native)        lifecycle channel — dispatched as 'sync.connect' / 'sync.disconnect' / 'sync.notfound'

// 'sync.' is the library's own namespace: only bootServer / bootClient may dispatch it, never a client envelope.
const RESERVED_PREFIX = 'sync.';

// An inbound envelope is attacker-controlled, so both wire boundaries normalize it here; `trusted` (the server relay) is the only caller allowed to keep the reserved namespace.
function envelope(p: any, trusted: boolean = false): { type: string; syncId: number | null; data: Record<string, any> } | null {
    const type: string = typeof p?.type === 'string' ? p.type : '';
    if (type === '' || (trusted === false && type.startsWith(RESERVED_PREFIX) === true)) { return null; }
    return { type, syncId: typeof p?.syncId === 'number' ? p.syncId : null, data: typeof p?.data === 'object' && p.data !== null ? p.data : {} };
}

function dispatch(roomio: RoomIO, type: string, id: string | undefined, data: Record<string, any> = {}, syncId?: number | null): void {
    // iterate a copy: a handler may finalize units, which mutates both tables mid-dispatch
    [...(Unit.type2units.get(type) ?? [])].forEach((unit) => {
        // socket callbacks run outside the scope machinery: a message landing after / mid-finalize must not fire a dying unit's handler.
        if (unit._.phase === 'finalized' || unit._.phase === 'finalizing') return;
        if (RoomIO.of(unit) !== roomio) return; // skip units of another root
        if (type[0] === '-' && unit._.sync.id !== syncId) return; // skip units of another sync node
        [...(unit._.listeners.get(type) ?? [])].forEach((entry) => entry.execute({ id, ...data }));
    });
}

//----------------------------------------------------------------------------------------------------
// boot
//----------------------------------------------------------------------------------------------------

function bootServer(roomio: RoomIO): Unit {
    const { room, root } = roomio;

    //---- state channel

    // a sync target is a unit registered in its direct parent's registry; nextId is monotonic so a unit keeps its id for life.
    let nextId = 1;
    // a node hidden from the client (visibility) is skipped with its whole subtree, so private state never reaches that client's wire.
    const captureStateTree = (clientId: string): SyncNode[] => {
        const nodes: SyncNode[] = [];
        const walk = (unit: Unit, parent: number | null): void => {
            const registry = unit._.parent?._.sync.registry ?? {};
            const names = Object.keys(registry);
            // _.Components is [base..., most-derived]; match the registered name from the tail.
            let name: string | undefined = undefined;
            for (let i = unit._.Components.length - 1; i >= 0 && name === undefined; i--) { name = names.find((key) => registry[key] === unit._.Components[i]); }
            if (name === undefined) {
                unit._.children.forEach((child) => walk(child, parent));   // pass-through: keep the same parent id
            } else {
                const data = unit._.sync;
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
        // connect / disconnect are mirrors: dispatch here, relay to the other members (socket.to excludes the sender, who dispatches from its own socket events), then refresh the roster.
        const announce = (type: string): void => {
            dispatch(roomio, type, socket.id);
            socket.to(room.id).emit('emitToClients', { type, syncId: null, id: socket.id, data: {} });
            roomio.emit('status', { clients: roomio.clients });
            dispatch(roomio, 'sync.statusupdate', undefined);
        };
        roomio.clients.push({ id: socket.id, name: query?.clientName ?? '' });
        announce('sync.connect');
        socket.on('emitToServer', (p: any) => {
            const message = envelope(p);
            if (message === null) { return; }   // a rejected envelope is dropped, never dispatched
            if (Array.isArray(p?.to)) {
                // relay targets are attacker-controlled: keep only this room's members (another room's socket id must stay unreachable) and stamp the real sender.
                const to = roomio.clients.filter((client) => p.to.includes(client.id));
                if (to.length > 0) { roomio.emit('emitToClients', { ...message, id: socket.id }, to); }
            } else {
                dispatch(roomio, message.type, socket.id, message.data, message.syncId);
            }
        });
        socket.on('disconnect', () => {
            roomio.clients = roomio.clients.filter((c) => c.id !== socket.id);
            lastEmits.delete(socket.id);
            announce('sync.disconnect');
        });
    });
    return root;
}

function bootClient(roomio: RoomIO): Unit {
    const { root } = roomio;

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
                    const state = existing._.sync.state;
                    for (const key of Object.keys(state)) {
                        if ((key in node.state) === false) { delete state[key]; }
                    }
                    Object.assign(state, node.state);
                    continue;
                }
                const nodeParent = node.parent === null ? root : reconcileMap.get(node.parent);
                const Component = nodeParent && nodeParent._.sync.registry[node.name];
                if (!Component) { continue; }
                // the hook stamps the node before the body runs, so its xsync.state sees the server state and the fixed id
                const unit = new Unit(nodeParent, Component, { _hook: (unit: Unit) => { unit._.sync.id = node.id; Object.assign(unit._.sync.state, node.state); } });
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

    //---- message channel: the server is trusted here (it relays 'sync.connect' / 'sync.disconnect' through this channel), so the envelope keeps the reserved namespace
    roomio.on('emitToClients', (p: any) => {
        const message = envelope(p, true);
        if (message !== null) { dispatch(roomio, message.type, p?.id, message.data, message.syncId); }
    });

    //---- lifecycle channel: own events dispatch from the own socket; other members' arrive via the server relay
    roomio.on('connect', () => dispatch(roomio, 'sync.connect', roomio.socket.id));
    roomio.on('disconnect', () => dispatch(roomio, 'sync.disconnect', roomio.socket.id));
    roomio.on('notfound', (payload: any) => dispatch(roomio, 'sync.notfound', roomio.socket.id, typeof payload === 'object' && payload !== null ? payload : {}));

    return root;
}

//----------------------------------------------------------------------------------------------------
// entry
//----------------------------------------------------------------------------------------------------

// one root component only: listeners for sync.* must live inside it, so compose with xnew.extend rather than a second argument.
export function boot<C extends ComponentFn<any, any>>(options: BootOptions, Component: C, props?: PropsOf<C>): Unit {
    // the root (and its body) exists once RoomIO is built; the channels below only wire onto it
    const roomio = new RoomIO(options, Component, props);
    return getSide() === 'server' ? bootServer(roomio) : bootClient(roomio);
}
