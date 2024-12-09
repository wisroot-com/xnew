import { xnew } from '../core/xnew';

export function PointerEvent(xnode) {
    const base = xnew();

    const map = new Map();
    
    base.on('pointerdown', (event) => {
        const id = event.pointerId;
        const rect = xnode.element.getBoundingClientRect();
        const position = getPosition(event, rect);

        map.set(id, { ...position });
        xnode.emit('down', event, { type: 'down', position });

        const xwin = xnew(window);
        xwin.on('pointermove', (event) => {
            const position = getPosition(event, rect);
            const previous = map.get(id);
            map.delete(id);
            const delta = { x: position.x - previous.x, y: position.y - previous.y };

            map.set(id, { ...position });
            xnode.emit('dragmove', event, { type: 'dragmove', position, delta });
        });

        xwin.on('pointerup', (event) => {
            const position = getPosition(event, rect);
            map.delete(id);
            xnode.emit('dragup', event, { type: 'dragup', position, });
            xwin.finalize();
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
