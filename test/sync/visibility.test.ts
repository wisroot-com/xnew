import { Unit } from '../../src/core/unit';
import { xnew, xsync } from '../../src/index';
import { ioMock, bootServer, asServer } from './io-mock';

// xsync.visibleTo — per-client projection. Each connected socket receives a tree captured for its own
// id, so a node restricted with visibleTo reaches only the clients it names (and its subtree with it).
// io-mock records every emitted 'sync' with the socket it went to (via to(clientId)); syncFor(id) reads
// the last tree delivered to that client.

describe('xsync.visibleTo (per-client projection)', () => {
    let hub: ReturnType<typeof ioMock>;
    beforeEach(() => { jest.useFakeTimers({ now: 0 }); Unit.reset(); hub = ioMock(); });
    afterEach(() => { Unit.engineRoot?.finalize(); jest.useRealTimers(); });

    // the last 'sync' tree captured for a given client id (io.to(clientId).emit).
    const syncFor = (clientId: string): any[] => hub.lastSyncFor(clientId) ?? [];

    // a per-client PlayerView: state visible only to its owner unless a shared reveal flag flips it public.
    function PlayerView(unit: Unit, { ownerId = '', secret = 0 }: any = {}) {
        const state = xsync.state({ ownerId, secret, revealed: false });
        asServer(() => {
            xsync.visibleTo((clientId) => state.revealed || clientId === state.ownerId);
            unit.on('reveal', () => { state.revealed = true; });
        });
        return {};
    }

    function Game(unit: Unit) {
        xsync.register({ PlayerView });
        asServer(() => {
            unit.on('sync.connect', ({ id }: any) => xnew(PlayerView, { key: id, ownerId: id, secret: id === 'c1' ? 11 : 22 }));
        });
        return {};
    }

    it('delivers each client only its own visibleTo node', () => {
        bootServer({ io: hub.io }, Game);
        hub.connect('c1');
        hub.connect('c2');
        asServer(() => Unit.update(Unit.engineRoot));

        const c1 = syncFor('c1');
        const c2 = syncFor('c2');
        expect(c1.map((n: any) => n.state.ownerId)).toEqual(['c1']);
        expect(c2.map((n: any) => n.state.ownerId)).toEqual(['c2']);
        expect(c1[0].state.secret).toBe(11);
        expect(c2[0].state.secret).toBe(22);
    });

    it('a public node reaches every client; a private node does not', () => {
        function Board(unit: Unit) { xsync.state({ turn: 3 }); return {}; }   // no visibleTo → public
        bootServer({ io: hub.io }, function Root(unit: Unit) {
            xsync.register({ Board, PlayerView });
            xnew(Board);
            asServer(() => { unit.on('sync.connect', ({ id }: any) => xnew(PlayerView, { key: id, ownerId: id, secret: 7 })); });
        });
        hub.connect('c1');
        hub.connect('c2');
        asServer(() => Unit.update(Unit.engineRoot));

        // both see Board; each sees only its own PlayerView
        expect(syncFor('c1').filter((n: any) => n.name === 'Board')).toHaveLength(1);
        expect(syncFor('c2').filter((n: any) => n.name === 'Board')).toHaveLength(1);
        expect(syncFor('c1').filter((n: any) => n.name === 'PlayerView').map((n: any) => n.state.ownerId)).toEqual(['c1']);
        expect(syncFor('c2').filter((n: any) => n.name === 'PlayerView').map((n: any) => n.state.ownerId)).toEqual(['c2']);
    });

    it('a reveal re-evaluates the predicate so a private node widens to every client', () => {
        bootServer({ io: hub.io }, Game);
        const s1 = hub.connect('c1');
        hub.connect('c2');
        asServer(() => Unit.update(Unit.engineRoot));
        expect(syncFor('c2').map((n: any) => n.state.ownerId)).toEqual(['c2']);   // c2 cannot see c1's node yet

        s1.emit('emitToServer', { type: 'reveal', data: {} });   // any client triggers the shared reveal
        asServer(() => Unit.update(Unit.engineRoot));

        // now c2 sees both players' nodes (predicate re-read state.revealed === true)
        expect(syncFor('c2').map((n: any) => n.state.ownerId).sort()).toEqual(['c1', 'c2']);
        expect(syncFor('c2').every((n: any) => n.state.revealed === true)).toBe(true);
    });

    it('hides a node subtree from an excluded client (children lose their parent link)', () => {
        function Secret(unit: Unit) { xsync.state({ card: 'A' }); return {}; }
        function Hand(unit: Unit, { ownerId = '' }: any = {}) {
            xsync.state({ ownerId });
            xsync.register({ Secret });
            asServer(() => xsync.visibleTo(ownerId));
            xnew(Secret);
            return {};
        }
        bootServer({ io: hub.io }, function Root(unit: Unit) {
            xsync.register({ Hand });
            // a single Hand owned by c1 only, so c2 is a genuinely excluded client
            asServer(() => { unit.on('sync.connect', ({ id }: any) => { if (id === 'c1') { xnew(Hand, { key: id, ownerId: id }); } }); });
        });
        hub.connect('c1');
        hub.connect('c2');
        asServer(() => Unit.update(Unit.engineRoot));

        // c1 sees its Hand + the nested Secret; c2 (excluded) sees neither — the whole subtree is gone
        expect(syncFor('c1').map((n: any) => n.name).sort()).toEqual(['Hand', 'Secret']);
        expect(syncFor('c2')).toHaveLength(0);
    });
});
