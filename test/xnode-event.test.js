import { XNode } from '../src/core/xnode';
import { xnew } from '../src/core/xnew';

beforeEach(() => {
    XNode.reset();
});

describe('xnode event', () => {
    it('basic', () => {
        return new Promise((resolve, reject) => {
            let state = false;
            xnew((xnode) => {
                xnode.on('test', () => {
                    state = true;
                })
                xnode.emit('test');
            });
            setTimeout(() => state ? resolve() : reject(new Error()), 100);
        });
    });

    it('broadcast #', () => {
        return new Promise((resolve, reject) => {
            let state = false;
            xnew((xnode) => {
                xnode.on('#test', () => {
                    state = true;
                })
            });
            xnew((xnode) => {
                xnode.emit('#test');
            });
            setTimeout(() => state ? resolve() : reject(), 100);
        });
    });

    it('broadcast +', () => {
        return new Promise((resolve, reject) => {
            let state = false;
            xnew((xnode) => {
                xnode.on('+test', () => {
                    state = true;
                })
                xnew((xnode) => {
                    xnode.emit('+test');
                });
            });
            setTimeout(() => state ? resolve() : reject(), 100);
        });
    });
});