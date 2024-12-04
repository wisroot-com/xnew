import { xnew } from '../core/xnew';

export function DragEvent(xnode) {
    const base = xnew();

    // prevent touch default event
    base.on('touchstart', (event) => {
        event.preventDefault();
    });

    const pmap = new Map();
    let valid = false;
    base.on('pointerdown', (event) => {
        const id = event.pointerId;
        valid = pmap.size === 0 ? true : false;

        const position = getPosition(event);
        pmap.set(id, position);

        xnode.emit('down', event, { type: 'down', position, });

        const xwin = xnew(window);
        xwin.on('pointermove', (event) => {
            if (event.pointerId === id) {
                const position = getPosition(event);
                if (valid === true) {
                    const delta = { x: position.x - pmap.get(id).x, y: position.y - pmap.get(id).y };
                    xnode.emit('move', event, { type: 'move', position, delta, });
                }
                pmap.set(id, position);
            }
        });

        xwin.on('pointerup', (event) => {
            if (event.pointerId === id) {
                const position = getPosition(event);
                xnode.emit('up', event, { type: 'up', position, });
                xwin.finalize();
                pmap.delete(id);
            }
        });
        xwin.on('pointercancel', (event) => {
            if (event.pointerId === id) {
                xwin.finalize();
                pmap.delete(id);
            }
        });
    });

    function getPosition(event) {
        const element = xnode.element;
        const rect = element.getBoundingClientRect();
       
        let scaleX = 1.0;
        let scaleY = 1.0;
        if (element.tagName.toLowerCase() === 'canvas' && Number.isFinite(element.width) && Number.isFinite(element.height)) {
            scaleX = element.width / rect.width;
            scaleY = element.height / rect.height;
        }
        return { x: scaleX * (event.clientX - rect.left), y: scaleY * (event.clientY - rect.top) };
    }
}
