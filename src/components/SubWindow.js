import { xnew, xnest } from '../core/xnew';
import { MouseEvent } from './MouseEvent';

export function SubWindow(xnode) {
    const absolute = xnest({ style: 'position: absolute;' });
    
    const mouse = xnew(MouseEvent);

    let offset = { x: 0, y: 0 };
    mouse.on('down', (event, { position }) => {
        offset.x = xnode.getPosition().x - position.x;
        offset.y = xnode.getPosition().y - position.y;
    });
    mouse.on('drag', (event, { position }) => {
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
