import { Unit } from '../../src/core/unit';
import { xnew, xsync } from '../../src/index';
import { ioMock, bootServer, bootClient } from './io-mock';

describe('xsync.server / xsync.client', () => {
    let hub: ReturnType<typeof ioMock>;
    beforeEach(() => { jest.useFakeTimers({ now: 0 }); Unit.reset(); hub = ioMock(); });
    afterEach(() => { Unit.engineRoot?.finalize(); jest.useRealTimers(); });

    it('server mode runs server block, skips client block', () => {
        const serverRan = jest.fn(); const clientRan = jest.fn();
        bootServer({ io: hub.io }, (u: Unit) => {
            xsync.server(() => { serverRan(); });
            xsync.client(() => { clientRan(); });
        });
        expect(serverRan).toHaveBeenCalledTimes(1);
        expect(clientRan).not.toHaveBeenCalled();
    });

    it('client mode runs client block, skips server block', () => {
        const serverRan = jest.fn(); const clientRan = jest.fn();
        bootClient({ socket: hub.connect() }, (u: Unit) => {
            xsync.server(() => { serverRan(); });
            xsync.client(() => { clientRan(); });
        });
        expect(clientRan).toHaveBeenCalledTimes(1);
        expect(serverRan).not.toHaveBeenCalled();
    });

    it('a plain xnew (no boot) follows the ambient environment (client under jsdom)', () => {
        const serverRan = jest.fn(); const clientRan = jest.fn();
        xnew((u: Unit) => {
            xsync.server(() => { serverRan(); });
            xsync.client(() => { clientRan(); });
        });
        expect(clientRan).toHaveBeenCalledTimes(1);   // jsdom = browser = client
        expect(serverRan).not.toHaveBeenCalled();
    });

    it('merges defines returned by the executed block onto the unit', () => {
        const unit = bootServer({ io: hub.io }, (u: Unit) => {
            xsync.server(() => ({ greet: () => 'hi-from-server' }));
            xsync.client(() => ({ draw: () => 'should-not-exist' }));
        });
        expect(typeof (unit as any).greet).toBe('function');
        expect((unit as any).greet()).toBe('hi-from-server');
        expect((unit as any).draw).toBeUndefined();   // client block skipped on server
    });

    it('client block builds real DOM on client; not invoked on server', () => {
        let el: any;
        bootClient({ socket: hub.connect() }, (u: Unit) => { xsync.client(() => { el = xnew.nest('<div>'); }); });
        expect(el.tagName).toBe('DIV');

        let el2: any = 'untouched';
        bootServer({ io: hub.io }, (u: Unit) => { xsync.client(() => { el2 = xnew.nest('<div>'); }); });
        expect(el2).toBe('untouched');   // client callback never ran, so nest never called
    });
});
