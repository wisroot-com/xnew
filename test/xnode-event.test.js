import { XNode } from '../src/core/xnode';
import { xnew } from '../src/core/xnew';

beforeEach(() => {
    XNode.reset();
});

describe('xnode event', () => {
    it('basic', () => {
        let state = 0;
        xnew(() => {
            const xnode = xnew.self;
            xnode.on('countup', () => state++);
            xnode.emit('countup');
            xnew(() => xnew.self.emit('countup'));
        });
        xnew(() => xnew.self.emit('countup'));
        expect(state).toBe(1);
    });

    it('broadcast ~', () => {
        let state = 0;
        xnew(() => {
            const xnode = xnew.self;
            xnode.on('~myevent', () => state++);
            xnode.emit('~myevent');
            xnew(() => xnew.self.emit('~myevent'));
        });
        expect(state).toBe(2);
    });
});