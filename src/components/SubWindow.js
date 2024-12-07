import { xnew, xnest } from '../core/xnew';
import { PointerEvent } from './PointerEvent';

export function SubWindow(xnode) {
    const absolute = xnest({ style: 'position: absolute;' });
    
    const pointer = xnew(PointerEvent);

    let offset = { x: 0, y: 0 };
    pointer.on('down', (event, { position }) => {
        offset.x = xnode.getPosition().x - position.x;
        offset.y = xnode.getPosition().y - position.y;
    });
    pointer.on('move', (event, { position }) => {
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
