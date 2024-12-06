import { xnew } from '../core/xnew';

export function DragEvent(xnode) {
    const base = xnew();

    // prevent touch default event
    base.on('touchstart', (event) => {
        event.preventDefault();
    });

    const map = new Map();
    let valid = false;
    base.on('pointerdown', (event) => {
        const id = event.pointerId;
        valid = map.size === 0 ? true : false;
        
        const rect = xnode.element.getBoundingClientRect();
        const position = getPosition(event, rect);
        map.set(id, position);

        xnode.emit('down', event, { type: 'down', position, });

        const xwin = xnew(window);
        xwin.on('pointermove', (event) => {
            if (event.pointerId === id) {
                const position = getPosition(event, rect);
                if (valid === true) {
                    const delta = { x: position.x - map.get(id).x, y: position.y - map.get(id).y };
                    xnode.emit('move', event, { type: 'move', position, delta, });
                }
                map.set(id, position);
            }
        });

        xwin.on('pointerup', (event) => {
            if (event.pointerId === id) {
                const position = getPosition(event, rect);
                xnode.emit('up', event, { type: 'up', position, });
                xwin.finalize();
                map.delete(id);
            }
        });
        xwin.on('pointercancel', (event) => {
            if (event.pointerId === id) {
                xwin.finalize();
                map.delete(id);
            }
        });
    });

    function getPosition(event, rect) {
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }
}
