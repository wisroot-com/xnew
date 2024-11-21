import { isString, isNumber, isObject, isFunction } from './common';
import { XNode } from './xnode';

//----------------------------------------------------------------------------------------------------
// xtimer
//----------------------------------------------------------------------------------------------------

export function xtimer(callback, delay, repeat = false) {
    
    return xnew((xnode) => {
        let id = null;
        let counter = 0;
        
        setTimeout(func, delay);

        return {
            finalize() {
                if (id !== null) {
                    clearTimeout(id);
                    id = null;
                }
            },
        }

        function func() {
            XNode.wrap(xnode.parent, callback);
            counter++;
            if (repeat === true) {
                id = setTimeout(func, delay)
            } else {
                xnode.finalize();
            }
        }
    });
}
