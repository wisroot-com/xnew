import { xnew, xnest } from '../core/xnew';
import { MoveEvent } from './MoveEvent';

export function SubWindow(xnode) {
    const absolute = xnest({ style: 'position: absolute;' });
    
    const move = xnew(MoveEvent);

    let offset = { x: 0, y: 0 };
    move.on('down', (event, { position }) => {
        offset.x = xnode.getPosition().x - position.x;
        offset.y = xnode.getPosition().y - position.y;
    });
    move.on('drag', (event, { position }) => {
        const moveto = { x: position.x + offset.x, y: position.y + offset.y };
        xnode.emit('drag', event, { position: moveto });
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
