import { xnew } from '../core/xnew';

export function PointerEvent(xnode) {
    const base = xnew();

    // prevent touch default event
    // base.on('touchstart', (event) => {
    //     event.preventDefault();
    // });

    const map = new Map();

    base.on('pointerdown', (event) => {
        const id = event.pointerId;
        
        const rect = xnode.element.getBoundingClientRect();
        const position = getPosition(event, rect);

        xnode.emit('down', event, { type: 'down', position });
        map.set(id, position);

        const xwin = xnew(window);
        xwin.on('pointermove', (event) => {
            if (event.pointerId === id) {
                const position = getPosition(event, rect);
                const prev = map.get(id);
                map.delete(id);
                const delta = { x: position.x - prev.x, y: position.y - prev.y };

                xnode.emit('dragmove', event, { type: 'dragmove', position, delta });
                map.set(id, position);
            }
        });

        xwin.on('pointerup', (event) => {
            if (event.pointerId === id) {
                const position = getPosition(event, rect);
                xnode.emit('dragup', event, { type: 'dragup', position, });
                xwin.finalize();
                map.delete(id);
            }
        });
    });

    function getPosition(event, rect) {
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }
}
