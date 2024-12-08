import { xnew } from '../core/xnew';

export function PointerEvent(xnode) {
    const base = xnew();

    const map = new Map();
    
    base.on('pointerdown', (event) => {
        const id = event.pointerId;
        const rect = xnode.element.getBoundingClientRect();
        const position = getPosition(event, rect);

        xnode.emit('down', event, { type: 'down', position });
        map.set(id, position);

        const xwin = xnew(window);
        xwin.on('pointermove', (event) => {
            const position = getPosition(event, rect);
            const previous = map.get(id);
            map.delete(id);
            const delta = { x: position.x - previous.x, y: position.y - previous.y };

            xnode.emit('dragmove', event, { type: 'dragmove', position, delta });
            map.set(id, position);
        });

        xwin.on('pointerup', (event) => {
            const position = getPosition(event, rect);
            xnode.emit('dragup', event, { type: 'dragup', position, });
            xwin.finalize();
            map.delete(id);
        });
    });

    base.on('pointermove', (event) => {
        const rect = xnode.element.getBoundingClientRect();
        const position = getPosition(event, rect);

        xnode.emit('move', event, { type: 'move', position });
    });

    base.on('pointerup', (event) => {
        const rect = xnode.element.getBoundingClientRect();
        const position = getPosition(event, rect);

        xnode.emit('up', event, { type: 'up', position });
    });

    function getPosition(event, rect) {
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }
}
