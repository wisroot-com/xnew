import { XNode } from './xnode';
import { xnew } from './xnew';

export function xtimer(callback, delay = 0) {
    
    return xnew((xnode) => {
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
                id = setTimeout(wcallback, timeout - time)
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

        function wcallback() {
            const repeat = XNode.wrap.call(xnode.parent, callback);
            if (repeat === true) {
                xnode.stop();
                offset = 0.0;
                xnode.start();
            } else {
                xnode.finalize();
            }
        }
    });
}
