import { xnew } from '../core/xnew';
import { xscope } from '../core/xscope';

export function Timer(xnode, callback, delay) {
    let id = null;
    let timeout = delay;
    let offset = 0.0;
    let start = 0.0;
    let time = 0.0;

    return {
        get time() {
            return time;
        },
        start() {
            start = Date.now();
            time = offset;
            id = setTimeout(internal, timeout - time)
        },
        update() {
            time = Date.now() - start + offset;
        },
        stop() {
            offset = Date.now() - start + offset;
            clearTimeout(id);
            id = null;
        },
        finalize() {
            if (id !== null) {
                clearTimeout(id);
            }
        },
    }

    function internal() {
        const repeat = xscope(xnode.parent, callback);
        if (repeat === true) {
            xnode.stop();
            offset = 0.0;
            xnode.start();
        } else {
            xnode.finalize();
        }
    }

}