import { Unit } from '../../src/core/unit';
import { xnew, xsync } from '../../src/index';
import { ioMock, bootServer, bootClient } from './io-mock';

describe('xsync.boot({ socket, room }) — in-memory socket.io', () => {
    let hub: ReturnType<typeof ioMock>;
    beforeEach(() => { jest.useFakeTimers({ now: 0 }); Unit.reset(); hub = ioMock(); });
    afterEach(() => { Unit.engineRoot?.finalize(); jest.useRealTimers(); });

    it('boots server + client on a shared hub and auto-numbers clientId', () => {
        bootServer({ io: hub.io }, function Server() {});
        let id1: string | undefined;
        let id2: string | undefined;
        bootClient({ socket: hub.connect() }, function C1() { xsync.client(() => { id1 = xsync.session.myself.id; }); });
        bootClient({ socket: hub.connect() }, function C2() { xsync.client(() => { id2 = xsync.session.myself.id; }); });
        expect(id1).toBe('c1');
        expect(id2).toBe('c2');
    });

    it('delivers sync.connect to a unit inside the booted root with the clientId', () => {
        // boot は sync.connect/sync.disconnect を root 配下の unit.on へ配る（socket の connect/disconnect は別途 host へ '-event' 転送）。
        const seen: string[] = [];
        bootServer({ io: hub.io }, function Server(unit: Unit) {
            unit.on('sync.connect', ({ id }: any) => seen.push(id));
        });
        hub.connect('cX');   // a fresh client connects on the same shared hub
        expect(seen).toEqual(['cX']);
    });

    it('detaches its io connection listener when the server root finalizes', () => {
        // ルームは生成・消滅を繰り返すので、死んだ root の listener が io に残ってはいけない（listener リーク）。
        const seen: string[] = [];
        const root = bootServer({ io: hub.io }, function Server(unit: Unit) {
            unit.on('sync.connect', ({ id }: any) => seen.push(id));
        });
        hub.connect('cX');
        expect(seen).toEqual(['cX']);

        root.finalize();
        hub.connect('cY');   // finalize 後の接続はもう届かない
        expect(seen).toEqual(['cX']);
    });

    it('environment selects which block runs at the root', () => {
        const ran: string[] = [];
        bootServer({ io: hub.io }, function S() { xsync.server(() => ran.push('server')); xsync.client(() => ran.push('client')); });
        expect(ran).toEqual(['server']);

        ran.length = 0;
        bootClient({ socket: hub.connect() }, function C() { xsync.server(() => ran.push('server')); xsync.client(() => ran.push('client')); });
        expect(ran).toEqual(['client']);
    });
});
