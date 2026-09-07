import { Unit } from '../../src/core/unit';
import { xnew, xsync } from '../../src/index';
import { ioMock, bootServer, bootClient, asServer } from './io-mock';

//----------------------------------------------------------------------------------------------------
// ルームステータス（xsync.session.room / clients / myself / sync.status）
//   - server: メンバ接続/切断で台帳(session.clients)が更新され、サブツリーへ sync.status が配られる。
//   - client: server からの status 配信を取り込み、sync.status を配る。session.myself は自分自身の ClientStatus。
//----------------------------------------------------------------------------------------------------

describe('room status (session.clients / session.myself / sync.status)', () => {
    let hub: ReturnType<typeof ioMock>;
    beforeEach(() => { jest.useFakeTimers({ now: 0 }); Unit.reset(); hub = ioMock(); });
    afterEach(() => { Unit.engineRoot?.finalize(); jest.useRealTimers(); });

    it('server status.clients tracks members; sync.status fires on connect/disconnect', () => {
        const snapshots: string[][] = [];
        bootServer({ io: hub.io }, function Server(unit: Unit) {
            xsync.server(() => { unit.on('sync.status', () => snapshots.push(xsync.session.clients.map((c) => c.id))); });
        });
        // connect/disconnect が server の sync.status を発火し、ハンドラが xsync.session を読むので server 環境で囲む。
        asServer(() => {
            const a = hub.connect('a');
            hub.connect('b');
            a.disconnect();
        });
        expect(snapshots).toEqual([['a'], ['a', 'b'], ['b']]);
    });

    it('client reads myself / clients via broadcast', () => {
        bootServer({ io: hub.io }, function Server() {});
        let myself: any, clients: any;
        bootClient({ socket: hub.connect('c1') }, function Client(unit: Unit) {
            xsync.client(() => { unit.on('sync.status', () => { myself = xsync.session.myself; clients = xsync.session.clients; }); });
        });
        hub.connect('c2');   // c2 の接続で server が status を全 client へ broadcast → 配線済みの c1 が受信
        expect(myself.id).toBe('c1');                                          // 自分自身の ClientStatus
        expect(clients.map((c: any) => c.id).sort()).toEqual(['c1', 'c2']);
    });
});
