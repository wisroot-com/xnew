import { xnew, xnest } from '../core/xnew';
import { DragEvent } from './DragEvent';

export function SubWindow(xnode) {
    const absolute = xnest({ style: 'position: absolute;' });
    
    const drag = xnew(DragEvent);

    let offset = { x: 0, y: 0 };
    drag.on('down', (event, { position }) => {
        offset.x = xnode.getPosition().x - position.x;
        offset.y = xnode.getPosition().y - position.y;
    });
    drag.on('move', (event, { position }) => {
        const moveto = { x: position.x + offset.x, y: position.y + offset.y };
        xnode.emit('move', event, { position: moveto });
    });

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
