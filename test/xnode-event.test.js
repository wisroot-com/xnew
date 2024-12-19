import { XNode } from '../src/core/xnode';
import { xnew, xthis } from '../src/core/xnew';

beforeEach(() => {
    XNode.reset();
});

describe('xnode event', () => {
    it('basic', () => {
        let state = 0;
        xnew(() => {
            const xnode = xthis();
            xnode.on('countup', () => state++);
            xnode.emit('countup');
            xnew(() => xthis().emit('countup'));
        });
        xnew(() => xthis().emit('countup'));
        expect(state).toBe(1);
    });

    it('broadcast ~', () => {
        let state = 0;
        xnew(() => {
            const xnode = xthis();
            xnode.on('~myevent', () => state++);
            xnode.emit('~myevent');
            xnew(() => xthis().emit('~myevent'));
        });
        expect(state).toBe(2);
    });
});