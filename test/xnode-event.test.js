import { XNode } from '../src/core/xnode';
import { xnew } from '../src/core/xnew';

beforeEach(() => {
    XNode.reset();
});

describe('xnode event', () => {
    it('basic', () => {
        let state = 0;
        xnew((xnode) => {
            xnode.on('countup', () => state++);
            xnode.emit('countup');
            xnew((xnode) => xnode.emit('countup'));
        });
        xnew((xnode) => xnode.emit('countup'));
        expect(state).toBe(1);
    });

    it('broadcast ~', () => {
        let state = 0;
        xnew((xnode) => {
            xnode.on('~resolve', () => state++);
            xnode.emit('~resolve');
            xnew((xnode) => xnode.emit('~resolve'));
        });
        expect(state).toBe(2);
    });
});