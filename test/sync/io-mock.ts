//----------------------------------------------------------------------------------------------------
// io-mock — in-memory socket.io-shaped transport + mode helpers for sync tests
//
// src no longer ships an in-memory transport (loopback was removed with the browser-only run model),
// and boot now auto-detects the side from the runtime (Node=server / browser=client). Tests run in one
// jsdom process yet must exercise BOTH sides, so this fixture provides:
//   - ioMock(): socket.io-shaped objects that boot uses directly (an `io` + `connect()` clients),
//     wired in-memory. Pass `io` to the server boot and `connect()` to a client boot; clientId
//     auto-numbers as 'c1', 'c2', ...
//   - bootServer/bootClient(): force the boot side (jsdom would otherwise always detect 'client').
//
// - ioMock() : { io, connect(id?) } — server-side io + client-socket factory, wired in-memory
// - bootServer(opts, Component, props?) / bootClient(opts, Component, props?) : xsync.boot with the mode forced
//----------------------------------------------------------------------------------------------------

import { xnew, xsync } from '../../src/index';
import { setSide } from '../../src/sync/side';

type Handler = (...args: any[]) => void;

//---- side override（テスト専用の人間工学） ---------------------------------------------------------
// src は setSide（書き）/ getSide（読み・内部）だけを持つ。ネスト対応の一時上書きは
// ここで組む。src への書き手はテストだけなので、直前値をこのモジュール内でミラーして復元する。
type Env = 'server' | 'client';
let currentOverride: Env | null = null;

function applySide(env: Env | null): void {
    currentOverride = env;
    setSide(env);
}

/** fn 実行中だけ side へ上書きし、終了時に直前の override（null 含む）へ戻す（ネスト可）。 */
function withSide<T>(env: Env, fn: () => T): T {
    const previous = currentOverride;
    applySide(env);
    try {
        return fn();
    } finally {
        applySide(previous);
    }
}

/** テストの既定 room。bootServer/bootClient が省略時に補い、connect も既定でここへ join する。 */
export const ROOM = { id: 'room', name: 'room', count: 0 };

/** socket.io の client socket 相当（boot({ io, client, room }) と生クライアントの両方で使う）。 */
export interface MockClientSocket {
    id: string;
    emit(event: string, payload?: any): void;
    on(event: string, handler: Handler): void;
    off(event: string, handler: Handler): void;
    disconnect(): void;
    fire(event: string, payload?: any): void;   // server→client 受信を擬似発火（自分の on(event) を client 環境で呼ぶ）
}

export interface IoMock {
    io: any;                                  // socket.io の io 相当（server 側）
    connect(id?: string, roomId?: string, clientName?: string): MockClientSocket;   // 1 接続ぶんの client socket を生成（roomId 省略時は既定 ROOM）
    captured: any[];                          // server boot が emit した 'sync' ツリーの記録（capture-only テスト用）
    lastSync(): any;                          // 直近に emit された 'sync' ツリー（capture は root.on('update') で走る）
    lastSyncFor(clientId: string): any;       // その client 宛て（io.to(clientId)）に直近 emit された 'sync' ツリー
    syncCountFor(clientId: string): number;   // その client 宛てに emit された 'sync' の回数（無変化スキップの検証用）
}

export function ioMock(): IoMock {
    let connectionCb: ((socket: any) => void) | null = null;
    let seq = 0;   // clientId 自動発番（'c1', 'c2', ...）
    const captured: any[] = [];   // boot が emit する 'sync' ツリーを記録（接続 client の有無に関わらず残す）
    const syncLog: { to: string; tree: any }[] = [];   // 'sync' の宛先つき記録（per-client 投影テスト用）

    interface Conn {
        clientHandlers: Map<string, Set<Handler>>;   // client.on(event)
        serverHandlers: Map<string, Set<Handler>>;   // server 側 socket.on(event)（bootServer が 'emitToServer' / 'disconnect' を張る）
        rooms: Set<string>;                           // 所属 room 群（自分の id room + socket.join(room) ぶん）
    }
    const conns = new Map<string, Conn>();

    // server→client: 該当 client の on(event) を発火する。client プロセスが受信する状況なので、
    // ハンドラ（boot の on('sync')→apply など）は client 環境で走らせる（server 環境のテスト中に server の
    // 自動 broadcast が同期的に client へ届くケースで、replica が client として構築されるように）。
    const deliverToClient = (conn: Conn, event: string, payload: any): void => withSide('client', () => {
        conn.clientHandlers.get(event)?.forEach((h) => h(payload));
    });

    const io = {
        on(event: string, cb: (socket: any) => void): void { if (event === 'connection') { connectionCb = cb; } },
        // boot は destroy で自分の connection を外す。外れた後の connect() はどのハンドラにも届かない。
        off(event: string, cb: (socket: any) => void): void {
            if (event === 'connection' && connectionCb === cb) { connectionCb = null; }
        },
        emit(event: string, payload?: any): void {                 // broadcast（全 client へ）
            if (event === 'sync') { captured.push(payload); }
            for (const conn of conns.values()) { deliverToClient(conn, event, payload); }
        },
        to(room: string) {
            // room に join した全 client へ配信する（room は room.id でも client の id でも可）。
            return { emit(event: string, payload?: any): void {
                if (event === 'sync') { captured.push(payload); syncLog.push({ to: room, tree: payload }); }
                for (const conn of conns.values()) {
                    if (conn.rooms.has(room)) { deliverToClient(conn, event, payload); }
                }
            } };
        },
    };

    function connect(id?: string, roomId: string = ROOM.id, clientName: string = ''): MockClientSocket {
        const clientId = id ?? 'c' + (++seq);
        // socket.io と同様、各 socket は自分の id の room に自動 join 済み（io.to(clientId) で個別宛が届く）。
        const conn: Conn = { clientHandlers: new Map(), serverHandlers: new Map(), rooms: new Set([clientId]) };
        conns.set(clientId, conn);

        // server 側 socket（bootServer が on('emitToServer') / on('disconnect') を張る）。query.roomId で入室先を伝える。
        connectionCb?.({
            id: clientId,
            handshake: { query: { roomId, clientName } },
            join(room: string): void { conn.rooms.add(room); },
            on(event: string, handler: Handler): void {
                let set = conn.serverHandlers.get(event);
                if (set === undefined) { set = new Set(); conn.serverHandlers.set(event, set); }
                set.add(handler);
            },
            // socket.io の socket.to(room) 相当：本人を除く room メンバーへ配信（boot の connect/disconnect relay が使う）
            to(room: string) {
                return { emit(event: string, payload?: any): void {
                    for (const c of conns.values()) {
                        if (c !== conn && c.rooms.has(room)) { deliverToClient(c, event, payload); }
                    }
                } };
            },
        });

        return {
            id: clientId,
            // client→server: the server processes inbound wire events under the server env (a relay
            // handler may fan out with xsync.emit, whose server branch needs it), mirroring deliverToClient's client wrap.
            emit(event: string, payload?: any): void { withSide('server', () => conn.serverHandlers.get(event)?.forEach((h) => h(payload))); },
            on(event: string, handler: Handler): void {
                let set = conn.clientHandlers.get(event);
                if (set === undefined) { set = new Set(); conn.clientHandlers.set(event, set); }
                set.add(handler);
            },
            // boot detaches its socket handlers when the client root destroys（socket.io の socket.off 相当）
            off(event: string, handler: Handler): void { conn.clientHandlers.get(event)?.delete(handler); },
            disconnect(): void { conns.delete(clientId); conn.serverHandlers.get('disconnect')?.forEach((h) => h()); },
            // server→client 受信を擬似発火: 自分の on(event) ハンドラ（boot の on('sync')→apply 等）を client 環境で呼ぶ。
            fire(event: string, payload?: any): void { deliverToClient(conn, event, payload); },
        };
    }

    function lastSyncFor(clientId: string): any {
        for (let i = syncLog.length - 1; i >= 0; i--) {
            if (syncLog[i].to === clientId) { return syncLog[i].tree; }
        }
        return undefined;
    }

    return {
        io, connect, captured, lastSync: () => captured[captured.length - 1], lastSyncFor,
        syncCountFor: (clientId: string) => syncLog.filter((entry) => entry.to === clientId).length,
    };
}

// 実行環境（server/client）を固定して同期的な処理を走らせる。1 プロセスで両側を模すテスト用。
// 構築（component body / xnew(...) / apply）に加え、session.myself / sync.emit も env で
// server/client を分岐する。よって server 側の処理（boot / server update での spawn / status）は asServer、client 側は
// asClient で囲む。両側を 1 回の update でまとめて回すと env がどちらかにしか合わないので、サブツリーを
// 各々の env で別々に tick する（例: channel.test の cycle）。apply は src 側で常に client 環境を強制する。

/** fn を server 環境で実行する。 */
export function asServer<T>(fn: () => T): T { return withSide('server', fn); }

/** fn を client 環境で実行する。 */
export function asClient<T>(fn: () => T): T { return withSide('client', fn); }

/** server 環境で非同期 fn を実行する（fake timer の flush 中に server spawn が走る場合用。完了まで env を保持）。 */
export async function asServerAsync<T>(fn: () => Promise<T>): Promise<T> {
    const previous = currentOverride;
    applySide('server');
    try { return await fn(); } finally { applySide(previous); }
}

/** xsync.boot を server 環境で呼ぶ（room 未指定なら既定 ROOM を補う）。 */
export function bootServer(opts: { io: any; room?: any }, Component: any, props?: object): ReturnType<typeof xsync.boot> {
    return asServer(() => xsync.boot({ room: ROOM, ...opts }, Component, props));
}

/**
 * xsync.boot を client 環境で呼ぶ（room 未指定なら既定 ROOM を補う）。
 * boot は client 側で io() を呼んで socket を生成するため、事前生成した socket は io: () => socket で包む。
 */
export function bootClient(opts: { socket: any; room?: any; client?: any; target?: any }, Component: any, props?: object): ReturnType<typeof xsync.boot> {
    const { socket, room = ROOM, client, target } = opts;
    const boot = () => xsync.boot({ room, client, io: () => socket }, Component, props);
    // boot 自身は target を取らないので、既存要素へ描くときは xnew(target, ...) で包む（本番も同じ形）。
    return asClient(() => {
        if (target === undefined) { return boot(); }
        let root!: ReturnType<typeof xsync.boot>;
        xnew(target, () => { root = boot(); });
        return root;
    });
}
