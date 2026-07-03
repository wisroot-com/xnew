import { Unit } from '../../src/core/unit';
import { xnew, xsync } from '../../src/index';
import { ioMock, bootServer, bootClient, asServer } from './io-mock';

//----------------------------------------------------------------------------------------------------
// ルームステータス（xsync.room / clients / myself / sync.statusupdate）
//   - server: メンバ接続/切断で台帳(sync.clients)が更新され、サブツリーへ sync.statusupdate が配られる。
//   - client: server からの status 配信を取り込み、sync.statusupdate を配る。sync.myself は自分自身の ClientStatus。
//----------------------------------------------------------------------------------------------------

describe('room status (sync.clients / sync.myself / sync.statusupdate)', () => {
    let hub: ReturnType<typeof ioMock>;
    beforeEach(() => { jest.useFakeTimers({ now: 0 }); Unit.reset(); hub = ioMock(); });
    afterEach(() => { Unit.engineRoot?.finalize(); jest.useRealTimers(); });

    it('server status.clients tracks members; sync.statusupdate fires on connect/disconnect', () => {
        const snapshots: string[][] = [];
        bootServer({ io: hub.io }, function Server(unit: Unit) {
            xsync.server(() => { unit.on('sync.statusupdate', () => snapshots.push(xsync.clients.map((c) => c.id))); });
        });
        // connect/disconnect が server の sync.statusupdate を発火し sync.status を読むので server 環境で囲む。
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
            xsync.client(() => { unit.on('sync.statusupdate', () => { myself = xsync.myself; clients = xsync.clients; }); });
        });
        hub.connect('c2');   // c2 の接続で server が status を全 client へ broadcast → 配線済みの c1 が受信
        expect(myself.id).toBe('c1');                                          // 自分自身の ClientStatus
        expect(clients.map((c: any) => c.id).sort()).toEqual(['c1', 'c2']);
    });
});
