import { Unit } from '../../src/core/unit';
import { xnew, xsync } from '../../src/index';
import { ioMock, bootServer, bootClient } from './io-mock';

describe('xsync.boot({ socket, room }) — in-memory socket.io', () => {
    let hub: ReturnType<typeof ioMock>;
    beforeEach(() => { jest.useFakeTimers({ now: 0 }); Unit.reset(); hub = ioMock(); });
    afterEach(() => { Unit.engineRoot?.destroy(); jest.useRealTimers(); });

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
        // boot は sync.connect/sync.disconnect を両サイドとも root 配下の unit.on へ配る（id で誰のイベントか判別する）。
        const seen: string[] = [];
        bootServer({ io: hub.io }, function Server(unit: Unit) {
            unit.on('sync.connect', ({ id }: any) => seen.push(id));
        });
        hub.connect('cX');   // a fresh client connects on the same shared hub
        expect(seen).toEqual(['cX']);
    });

    it('detaches its io connection listener when the server root destroys', () => {
        // ルームは生成・消滅を繰り返すので、死んだ root の listener が io に残ってはいけない（listener リーク）。
        const seen: string[] = [];
        const root = bootServer({ io: hub.io }, function Server(unit: Unit) {
            unit.on('sync.connect', ({ id }: any) => seen.push(id));
        });
        hub.connect('cX');
        expect(seen).toEqual(['cX']);

        root.destroy();
        hub.connect('cY');   // destroy 後の接続はもう届かない
        expect(seen).toEqual(['cX']);
    });

    it('relays other members\' connect/disconnect to client roots as sync.* with their id', () => {
        // 他メンバーの connect/disconnect はサーバが relay する（自分のぶんは自分の socket イベントから届く）。
        bootServer({ io: hub.io }, function Server() {});
        const log: string[] = [];
        bootClient({ socket: hub.connect('c1') }, function Client(unit: Unit) {
            unit.on('sync.connect', ({ id }: any) => log.push(`connect:${id}`));
            unit.on('sync.disconnect', ({ id }: any) => log.push(`disconnect:${id}`));
        });
        const c2 = hub.connect('c2');
        c2.disconnect();
        expect(log).toEqual(['connect:c2', 'disconnect:c2']);
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
