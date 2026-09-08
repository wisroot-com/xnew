import { Unit } from '../../src/core/unit';
import { xnew, xsync } from '../../src/index';
import { ioMock, bootServer, bootClient, asServer, asClient } from './io-mock';

//----------------------------------------------------------------------------------------------------
// wire guard — an 'emitToServer' envelope is attacker-controlled, so bootServer validates it before
// dispatching. 'sync.' is the library's own lifecycle namespace and must stay unreachable from a client;
// these tests raw-emit the envelope (bypassing xsync.emit) the way a hostile client would.
//----------------------------------------------------------------------------------------------------

describe('xsync client envelope validation', () => {
    let hub: ReturnType<typeof ioMock>;
    beforeEach(() => { jest.useFakeTimers({ now: 0 }); Unit.reset(); hub = ioMock(); });
    afterEach(() => { Unit.engineRoot?.destroy(); jest.useRealTimers(); });

    it('drops a client envelope naming a reserved sync.* type', () => {
        const spoofed: any[] = [];
        bootServer({ io: hub.io }, function Server(unit: Unit) {
            xsync.server(() => {
                unit.on('sync.disconnect', ({ id }: any) => spoofed.push(id));
                unit.on('sync.update', () => spoofed.push('update'));
            });
        });
        const socket = hub.connect('A');

        socket.emit('emitToServer', { type: 'sync.disconnect', syncId: null, data: {} });
        socket.emit('emitToServer', { type: 'sync.update', syncId: null, data: {} });

        expect(spoofed).toEqual([]);
    });

    it('still delivers a genuine disconnect to the same listener', () => {
        const seen: any[] = [];
        bootServer({ io: hub.io }, function Server(unit: Unit) {
            xsync.server(() => { unit.on('sync.disconnect', ({ id }: any) => seen.push(id)); });
        });
        const socket = hub.connect('A');

        socket.disconnect();

        expect(seen).toEqual(['A']);
    });

    it('keeps ordinary app types working', () => {
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

    it('drops a malformed type instead of throwing', () => {
        const got: any[] = [];
        bootServer({ io: hub.io }, function Server(unit: Unit) {
            xsync.server(() => { unit.on('hit', () => got.push('x')); });
        });
        const socket = hub.connect('A');

        expect(() => {
            socket.emit('emitToServer', { type: 123, data: {} });
            socket.emit('emitToServer', { type: '', data: {} });
            socket.emit('emitToServer', {});
            socket.emit('emitToServer', undefined);
        }).not.toThrow();
        expect(got).toEqual([]);
    });

    it('relays only to targets in the room roster (an outsider socket id is dropped)', () => {
        const outside: any[] = [];
        const inside: any[] = [];
        bootServer({ io: hub.io }, function Server() { xsync.server(() => {}); });
        const socket = hub.connect('A');
        const other = hub.connect('OUT', 'other-room');   // 別ルームの socket（この room の roster には載らない）
        const b = hub.connect('B');
        other.on('emitToClients', (p: any) => outside.push(p));
        b.on('emitToClients', (p: any) => inside.push(p));

        socket.emit('emitToServer', { type: 'peek', syncId: null, data: {}, to: ['OUT', 'B'] });

        expect(outside).toEqual([]);   // 別ルームの id へは中継しない
        expect(inside).toEqual([{ type: 'peek', syncId: null, id: 'A', data: {} }]);
    });

    it('drops a relay envelope naming a reserved sync.* type', () => {
        const relayed: any[] = [];
        bootServer({ io: hub.io }, function Server() { xsync.server(() => {}); });
        const socket = hub.connect('A');
        const b = hub.connect('B');
        b.on('emitToClients', (p: any) => relayed.push(p));

        socket.emit('emitToServer', { type: 'sync.disconnect', syncId: null, data: {}, to: ['B'] });

        expect(relayed).toEqual([]);
    });

    it('normalizes a non-numeric syncId so it cannot match a real node', () => {
        const got: any[] = [];
        bootServer({ io: hub.io }, function Server() {
            xsync.server(() => {
                asServer(() => xnew(function Node(unit: Unit) {
                    (unit)._.sync.id = 10;
                    unit.on('-move', () => got.push('moved'));
                }));
            });
        });
        const socket = hub.connect('A');

        socket.emit('emitToServer', { type: '-move', syncId: '10', data: {} });

        expect(got).toEqual([]);
    });
});
