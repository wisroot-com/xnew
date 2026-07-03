//----------------------------------------------------------------------------------------------------
// sync/boot — per-runtime root creation + wiring (bootServer / bootClient)
//
// The server root is the source of truth: on every update it captures its sync targets as a flat
// pre-order node list and emits 'sync'; each client root diff-applies that tree (create/update/remove).
// A sync target is a unit whose type is registered in its direct parent's registry (xsync.register).
//
// - bootServer / bootClient : create a sync root bound to a socket (chosen by env in the facade's boot)
//
// Invariants: node ids are monotonic per server root (`nextId`) so a unit keeps its id for its whole
// lifetime; capture runs on the root's own update, which fires AFTER children update, so it sees this
// tick's child mutations. captureStateTree / applyStateTree are boot-internal closures (over `root`),
// never exported — drive them through the 'sync' emit/apply seam.
//----------------------------------------------------------------------------------------------------

import { Unit } from '../core/unit';
import {
    SyncNode, ServerInfo, ClientInfo, ClientStatus,
    BootServerOptions, BootClientOptions,
    SYNC_KEY, syncOf, seedSyncData, registryOfParent,
    dispatch, relayToClients, WIRE_TO_SERVER, WIRE_TO_CLIENT, WIRE_DELIVER,
} from './internal';

export function bootServer(opts: BootServerOptions, parent: Unit, args: any[]): Unit {
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
            const registry = registryOfParent(unit);
            if (registry === undefined) { return undefined; }
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

export function bootClient(opts: BootClientOptions, parent: Unit, args: any[]): Unit {
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
            seedSyncData(unit, { id: node.id, state: { ...node.state }, registry: {} });
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
