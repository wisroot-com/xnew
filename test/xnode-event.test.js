import { XNode } from '../src/core/xnode';
import { xnew } from '../src/core/xnew';

beforeEach(() => {
    XNode.boot();
});

describe('xnode event', () => {
    it('basic', () => {
        return new Promise((resolve, reject) => {
            let state = 0;
            xnew((xnode) => {
                xnode.on('resolve', () => state++);
                xnode.emit('resolve');
                xnew((xnode) => xnode.emit('resolve'));
            });
            xnew((xnode) => xnode.emit('resolve'));
            setTimeout(() => state === 1 ? resolve() : reject(new Error()), 100);
        });
    });

    it('broadcast #', () => {
        return new Promise((resolve, reject) => {
            let state = 0;
            xnew((xnode) => {
                xnode.on('#resolve', () => state++);
                xnode.emit('#resolve');
                xnew((xnode) => xnode.emit('#resolve'));
            });
            xnew((xnode) => xnode.emit('#resolve'));
            setTimeout(() => state === 3 ? resolve() : reject(), 100);
        });
    });

    it('broadcast +', () => {
        return new Promise((resolve, reject) => {
            let state = 0;
            xnew((xnode) => {
                xnode.on('+resolve', () => state++);
                xnode.emit('+resolve');
                xnew((xnode) => xnode.emit('+resolve'));
            });
            xnew((xnode) => xnode.emit('+resolve'));
            setTimeout(() => state === 2 ? resolve() : reject(), 100);
        });
    });
});