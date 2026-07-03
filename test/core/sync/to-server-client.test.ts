import { Unit } from '../../../src/core/unit';
import { xnew, xsync } from '../../../src/index';
import { syncOf } from '../../../src/sync';
import { ioMock, bootServer, bootClient, asServer, asClient } from './io-mock';

//----------------------------------------------------------------------------------------------------
// sync.emitToServer / sync.emitToClient — 方向を明示するイベント送信
//   - emitToServer(type, props)      : 必ず SERVER 側で type を発火。client→server（送信者 id 付き・'-' は syncId 限定）、
//                                   server 側からは local emit（xnew.emit 相当）。
//   - emitToClient(type, props, ids?): 必ず CLIENT 側で（server 経由）type を発火。client→server→全 client（自分含む）、
//                                   server 側からは全 client へ。ids 指定で宛先を限定。
//   transport は in-memory な socket.io 風モック（test/core/sync/io-mock）を使う。
//----------------------------------------------------------------------------------------------------

describe('sync.emitToServer / sync.emitToClient', () => {
    let hub: ReturnType<typeof ioMock>;
    beforeEach(() => { jest.useFakeTimers({ now: 0 }); Unit.reset(); hub = ioMock(); });
    afterEach(() => { Unit.engineRoot?.finalize(); jest.useRealTimers(); });

    // ---- emitToServer ----

    it('emitToServer (client): fires on the server with the sender id', () => {
        const got: any[] = [];
        bootServer({ io: hub.io }, function Server(unit: Unit) {
            xsync.server(() => { unit.on('hit', ({ id, n }: any) => got.push({ id, n })); });
        });
        const client = bootClient({ socket: hub.connect('A') }, function Client(unit: Unit) {
            xsync.client(() => { return { fire() { xsync.emitToServer('hit', { n: 1 }); } }; });
        });

        asClient(() => (client as any).fire());

        expect(got).toEqual([{ id: 'A', n: 1 }]);
    });

    it('emitToServer (server): is a local emit (xnew.emit) — reaches +/- listeners on the current root', () => {
        const got: string[] = [];
        const server = bootServer({ io: hub.io }, function Server(unit: Unit) {
            xsync.server(() => {
                unit.on('+ping', ({ n }: any) => got.push(`ping:${n}`));
                return { ping() { xsync.emitToServer('+ping', { n: 2 }); } };
            });
        });

        asServer(() => (server as any).ping());

        expect(got).toEqual(['ping:2']);   // local emit が同一 root の '+ping' に届く
    });

    it("emitToServer ('-type'): only the server unit sharing the sender's syncId receives it", () => {
        const hits: string[] = [];
        function Tagged(unit: Unit, props: { tag?: string; syncId?: number } = {}) {
            syncOf(unit).id = props.syncId ?? null;
            xsync.server(() => { unit.on('-move', ({ x }: any) => hits.push(`${props.tag}:${x}`)); });
        }
        bootServer({ io: hub.io }, function Server() {
            xsync.server(() => { xnew(Tagged, { tag: 'A', syncId: 10 }); xnew(Tagged, { tag: 'B', syncId: 20 }); });
        });
        const client = bootClient({ socket: hub.connect() }, function Client(unit: Unit) {
            xsync.client(() => {
                syncOf(unit).id = 10;
                return { move() { xsync.emitToServer('-move', { x: 1 }); } };
            });
        });

        asClient(() => (client as any).move());

        expect(hits).toEqual(['A:1']);   // syncId=20 の B には届かない
    });

    // ---- emitToClient ----

    it('emitToClient (client): reaches every client incl. the sender, with the sender id', () => {
        const a: any[] = [];
        const b: any[] = [];
        bootServer({ io: hub.io }, function Server() { xsync.server(() => {}); });
        const clientA = bootClient({ socket: hub.connect('A') }, function Client(unit: Unit) {
            xsync.client(() => {
                unit.on('chat', ({ id, text }: any) => a.push({ id, text }));
                return { say(text: string) { xsync.emitToClient('chat', { text }); } };
            });
        });
        bootClient({ socket: hub.connect('B') }, function Client(unit: Unit) {
            xsync.client(() => { unit.on('chat', ({ id, text }: any) => b.push({ id, text })); });
        });

        asClient(() => (clientA as any).say('hi'));

        expect(a).toEqual([{ id: 'A', text: 'hi' }]);   // 自分にも返る
        expect(b).toEqual([{ id: 'A', text: 'hi' }]);
    });

    it('emitToClient (server): broadcasts to every client with id undefined', () => {
        const a: any[] = [];
        const server = bootServer({ io: hub.io }, function Server(unit: Unit) {
            xsync.server(() => { return { announce(text: string) { xsync.emitToClient('chat', { text }); } }; });
        });
        bootClient({ socket: hub.connect('A') }, function Client(unit: Unit) {
            xsync.client(() => { unit.on('chat', ({ id, text }: any) => a.push({ id, text })); });
        });

        asServer(() => (server as any).announce('hello'));

        expect(a).toEqual([{ id: undefined, text: 'hello' }]);
    });

    it('emitToClient with ids: delivers only to the listed clients', () => {
        const a: any[] = [];
        const b: any[] = [];
        const c: any[] = [];
        const server = bootServer({ io: hub.io }, function Server(unit: Unit) {
            xsync.server(() => { return { dm(text: string, ids: string[]) { xsync.emitToClient('chat', { text }, ids); } }; });
        });
        bootClient({ socket: hub.connect('A') }, function Client(unit: Unit) {
            xsync.client(() => { unit.on('chat', ({ text }: any) => a.push(text)); });
        });
        bootClient({ socket: hub.connect('B') }, function Client(unit: Unit) {
            xsync.client(() => { unit.on('chat', ({ text }: any) => b.push(text)); });
        });
        bootClient({ socket: hub.connect('C') }, function Client(unit: Unit) {
            xsync.client(() => { unit.on('chat', ({ text }: any) => c.push(text)); });
        });

        asServer(() => (server as any).dm('psst', ['A', 'C']));

        expect(a).toEqual(['psst']);
        expect(b).toEqual([]);          // 宛先外には届かない
        expect(c).toEqual(['psst']);
    });
});
