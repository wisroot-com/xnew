import { Unit } from '../../src/core/unit';
import { xnew, xsync } from '../../src/index';
import { ioMock, bootServer, bootClient, asServer, asClient } from './io-mock';

//----------------------------------------------------------------------------------------------------
// sync.emit — client-server-client をまたぐ 1 本の送信 emit(type, props, clients?)
//   - 宛先なし: client からは server で type を発火（送信者 id 付き・'-' は syncId 限定）、
//               server からはルームの全 client（自分含む・envelope id は undefined）。
//   - clients あり（ClientStatus か その配列）: server 経由でその client だけに届く。空配列は誰にも届かない。
//   transport は in-memory な socket.io 風モック（test/sync/io-mock）を使う。
//----------------------------------------------------------------------------------------------------

describe('sync.emit', () => {
    let hub: ReturnType<typeof ioMock>;
    beforeEach(() => { jest.useFakeTimers({ now: 0 }); Unit.reset(); hub = ioMock(); });
    afterEach(() => { Unit.engineRoot?.finalize(); jest.useRealTimers(); });

    // ---- 宛先なし（1 ホップ） ----

    it('emit (client): fires on the server with the sender id', () => {
        const got: any[] = [];
        bootServer({ io: hub.io }, function Server(unit: Unit) {
            xsync.server(() => { unit.on('hit', ({ id, n }: any) => got.push({ id, n })); });
        });
        const client = bootClient({ socket: hub.connect('A') }, function Client() {
            xsync.client(() => { return { fire() { xsync.emit('hit', { n: 1 }); } }; });
        });

        asClient(() => (client as any).fire());

        expect(got).toEqual([{ id: 'A', n: 1 }]);
    });

    it('emit (server): broadcasts to every client with id undefined', () => {
        const a: any[] = [];
        const server = bootServer({ io: hub.io }, function Server() {
            xsync.server(() => { return { announce(text: string) { xsync.emit('chat', { text }); } }; });
        });
        bootClient({ socket: hub.connect('A') }, function Client(unit: Unit) {
            xsync.client(() => { unit.on('chat', ({ id, text }: any) => a.push({ id, text })); });
        });

        asServer(() => (server as any).announce('hello'));

        expect(a).toEqual([{ id: undefined, text: 'hello' }]);
    });

    it("emit ('-type'): only the server unit sharing the sender's syncId receives it", () => {
        const hits: string[] = [];
        function Tagged(unit: Unit, props: { tag?: string; syncId?: number } = {}) {
            (unit)._.sync.id = props.syncId ?? null;
            xsync.server(() => { unit.on('-move', ({ x }: any) => hits.push(`${props.tag}:${x}`)); });
        }
        bootServer({ io: hub.io }, function Server() {
            xsync.server(() => { xnew(Tagged, { tag: 'A', syncId: 10 }); xnew(Tagged, { tag: 'B', syncId: 20 }); });
        });
        const client = bootClient({ socket: hub.connect() }, function Client(unit: Unit) {
            xsync.client(() => {
                (unit)._.sync.id = 10;
                return { move() { xsync.emit('-move', { x: 1 }); } };
            });
        });

        asClient(() => (client as any).move());

        expect(hits).toEqual(['A:1']);   // syncId=20 の B には届かない
    });

    it('dispatch: a finalized server unit does not receive a late client message', () => {
        const hits: string[] = [];
        let target!: Unit;
        bootServer({ io: hub.io }, function Server() {
            xsync.server(() => {
                target = xnew(function Target(u: Unit) { u.on('hit', () => hits.push('x')); });
            });
        });
        const client = bootClient({ socket: hub.connect('A') }, function Client() {
            xsync.client(() => { return { fire() { xsync.emit('hit', {}); } }; });
        });

        asServer(() => target.finalize());
        asClient(() => (client as any).fire());

        expect(hits).toEqual([]);   // the dying unit's handler must not fire
    });

    it('client→server→clients relay: a server handler re-broadcasts, carrying the sender id in props', () => {
        const a: any[] = [];
        const b: any[] = [];
        // server relays 'chat' to every client, naming the original sender via props.id (overrides the undefined envelope id)
        bootServer({ io: hub.io }, function Server(unit: Unit) {
            xsync.server(() => { unit.on('chat', ({ id, text }: any) => xsync.emit('chat', { id, text })); });
        });
        const clientA = bootClient({ socket: hub.connect('A') }, function Client(unit: Unit) {
            xsync.client(() => {
                unit.on('chat', ({ id, text }: any) => a.push({ id, text }));
                return { say(text: string) { xsync.emit('chat', { text }); } };
            });
        });
        bootClient({ socket: hub.connect('B') }, function Client(unit: Unit) {
            xsync.client(() => { unit.on('chat', ({ id, text }: any) => b.push({ id, text })); });
        });

        asClient(() => (clientA as any).say('hi'));

        expect(a).toEqual([{ id: 'A', text: 'hi' }]);   // 自分にも返る
        expect(b).toEqual([{ id: 'A', text: 'hi' }]);
    });

    // ---- clients 指定 ----

    it('emit with clients (server): delivers only to the listed clients', () => {
        const a: any[] = [];
        const b: any[] = [];
        const c: any[] = [];
        const server = bootServer({ io: hub.io }, function Server() {
            xsync.server(() => {
                return { dm(text: string, names: string[]) { xsync.emit('chat', { text }, xsync.session.clients.filter((client) => names.includes(client.id))); } };
            });
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

    it('emit with one ClientStatus (client): relayed through the server to that client only, with the sender id', () => {
        const a: any[] = [];
        const b: any[] = [];
        const c: any[] = [];
        const hits: string[] = [];
        bootServer({ io: hub.io }, function Server(unit: Unit) {
            xsync.server(() => { unit.on('whisper', () => hits.push('server')); });   // 中継のみ、server では発火しない
        });
        const clientA = bootClient({ socket: hub.connect('A') }, function Client(unit: Unit) {
            xsync.client(() => {
                unit.on('whisper', ({ id, text }: any) => a.push({ id, text }));
                return { whisper(to: string, text: string) { xsync.emit('whisper', { text }, xsync.session.clients.find((client) => client.id === to)!); } };
            });
        });
        bootClient({ socket: hub.connect('B') }, function Client(unit: Unit) {
            xsync.client(() => { unit.on('whisper', ({ id, text }: any) => b.push({ id, text })); });
        });
        bootClient({ socket: hub.connect('C') }, function Client(unit: Unit) {
            xsync.client(() => { unit.on('whisper', ({ id, text }: any) => c.push({ id, text })); });
        });

        asClient(() => (clientA as any).whisper('B', 'hey'));

        expect(b).toEqual([{ id: 'A', text: 'hey' }]);   // 送信者 id は server が封筒に載せる
        expect(a).toEqual([]);                            // 自分には返らない（宛先に入れていない）
        expect(c).toEqual([]);
        expect(hits).toEqual([]);                         // server は中継するだけ
    });

    it('emit with a ClientStatus[] (client): relayed to each listed client, including the sender', () => {
        const a: any[] = [];
        const b: any[] = [];
        const c: any[] = [];
        bootServer({ io: hub.io }, function Server() { xsync.server(() => {}); });
        const clientA = bootClient({ socket: hub.connect('A') }, function Client(unit: Unit) {
            xsync.client(() => {
                unit.on('deal', ({ id, card }: any) => a.push({ id, card }));
                return { deal(names: string[]) { xsync.emit('deal', { card: 7 }, xsync.session.clients.filter((client) => names.includes(client.id))); } };
            });
        });
        bootClient({ socket: hub.connect('B') }, function Client(unit: Unit) {
            xsync.client(() => { unit.on('deal', ({ id, card }: any) => b.push({ id, card })); });
        });
        bootClient({ socket: hub.connect('C') }, function Client(unit: Unit) {
            xsync.client(() => { unit.on('deal', ({ id, card }: any) => c.push({ id, card })); });
        });

        asClient(() => (clientA as any).deal(['A', 'C']));

        expect(a).toEqual([{ id: 'A', card: 7 }]);
        expect(b).toEqual([]);
        expect(c).toEqual([{ id: 'A', card: 7 }]);
    });

    it('emit with an empty array: reaches nobody (neither the server nor a client)', () => {
        const got: string[] = [];
        const a: any[] = [];
        const server = bootServer({ io: hub.io }, function Server(unit: Unit) {
            xsync.server(() => {
                unit.on('hit', () => got.push('server'));
                return { announce() { xsync.emit('chat', { text: 'x' }, []); } };
            });
        });
        const clientA = bootClient({ socket: hub.connect('A') }, function Client(unit: Unit) {
            xsync.client(() => {
                unit.on('chat', ({ text }: any) => a.push(text));
                return { fire() { xsync.emit('hit', {}, []); } };
            });
        });

        asClient(() => (clientA as any).fire());
        asServer(() => (server as any).announce());

        expect(got).toEqual([]);   // 宛先なしの emit と違い、server へは上がらない
        expect(a).toEqual([]);
    });
});
