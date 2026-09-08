import { Unit } from '../../src/core/unit';
import { xnew, xsync } from '../../src/index';
import { ioMock, bootServer, bootClient } from './io-mock';

// mode（server/client）は実行環境で決まる（Node=server / browser=client、sync/xsync）。
// xsync.server / xsync.client は現在の環境を見て、その環境のブロックだけを実行する。

describe('xsync.server / xsync.client by environment', () => {
    let hub: ReturnType<typeof ioMock>;
    beforeEach(() => { jest.useFakeTimers({ now: 0 }); Unit.reset(); hub = ioMock(); });
    afterEach(() => { Unit.engineRoot?.destroy(); jest.useRealTimers(); });

    it('server environment runs server blocks for the root and nested units', () => {
        const ran: string[] = [];
        bootServer({ io: hub.io }, (_: Unit) => {
            xsync.server(() => { ran.push('root-server'); });
            xsync.client(() => { ran.push('root-client'); });
            xnew((_c: Unit) => {
                xsync.server(() => { ran.push('child-server'); });
                xsync.client(() => { ran.push('child-client'); });
            });
        });
        expect(ran).toEqual(['root-server', 'child-server']);   // 環境はサブツリー全体に効く
    });

    it('client environment runs client blocks', () => {
        const ran: string[] = [];
        bootClient({ socket: hub.connect() }, (_: Unit) => {
            xsync.server(() => { ran.push('server'); });
            xsync.client(() => { ran.push('client'); });
        });
        expect(ran).toEqual(['client']);
    });
});

describe('xsync.boot', () => {
    let hub: ReturnType<typeof ioMock>;
    beforeEach(() => { jest.useFakeTimers({ now: 0 }); Unit.reset(); hub = ioMock(); });
    afterEach(() => { Unit.engineRoot?.destroy(); jest.useRealTimers(); });

    it('creates and returns the root unit', () => {
        const unit = bootServer({ io: hub.io }, (_: Unit) => {});
        expect(unit).toBeInstanceOf(Unit);
    });

    it('forwards extra args to the unit (target, Component)', () => {
        const el = document.createElement('div');
        const unit = bootClient({ socket: hub.connect() }, el, (_: Unit) => {});
        expect(unit.current).toBe(el);
    });

    it('propagates a throw from the component', () => {
        expect(() => bootServer({ io: hub.io }, () => { throw new Error('boom'); })).toThrow('boom');
    });
});
