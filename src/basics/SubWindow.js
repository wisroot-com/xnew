import { xnew } from '../core/xnew';
import { DragEvent } from './DragEvent';

export function SubWindow() {
    const xnode = xnew.current;
    const absolute = xnest({ style: 'position: absolute;' });
    
    return {
        setPosition(x, y) {
            absolute.style.left = x + 'px';
            absolute.style.top = y + 'px';
        },
        getPosition() {
            return { x: absolute.offsetLeft, y: absolute.offsetTop };
        },
    }
}
