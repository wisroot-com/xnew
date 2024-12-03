import { xnew } from '../core/xnew';

export function SubWindow(xnode) {
    xnest({ style: 'position: relative; width: 100%; height: 100%; overflow: hidden; user-select: none;' });
    xnest({ style: 'position: absolute; inset: 0; margin: auto; user-select: none;' });
    xnest({ style: 'position: relative; width: 100%; height: 100%; user-select: none;' });
    

    return {
        
    }
}
