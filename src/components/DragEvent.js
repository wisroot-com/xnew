import { xnew } from '../core/xnew';

export function DragEvent(xnode) {
    const base = xnew();
    const xwin = xnew(window);

    // prevent touch default event
    base.on('touchstart', (event) => {
        event.preventDefault();
    });

    base.on('pointerdown', (event) => {
        const id = getId(event);
        let position = getPosition(event, id);
        let prev = position;

        xnode.emit('down', event, { type: 'down', position, });

        xwin.on('pointermove', (event) => {
            position = getPosition(event, id);
            if (position !== null) {
                const delta = { x: position.x - prev.x, y: position.y - prev.y };
                xnode.emit('move', event, { type: 'move', position, delta, });
                prev = position;
            }
        });

        xwin.on('pointerup', (event) => {
            position = getPosition(event, id);
            if (position !== null) {
                xnode.emit('up', event, { type: 'up', position, });
                xwin.off();
            }
        });
    });

    function getId(event) {
        if (event.pointerId !== undefined) {
            return event.pointerId;
        } else if (event.changedTouches !== undefined) {
            return event.changedTouches[event.changedTouches.length - 1].identifier;
        } else {
            return null;
        }
    }

    function getPosition(event, id) {
        let original = null;
        if (event.pointerId !== undefined) {
            if (id === event.pointerId) original = event;
        } else if (event.changedTouches !== undefined) {
            for (let i = 0; i < event.changedTouches.length; i++) {
                if (id === event.changedTouches[i].identifier) original = event.changedTouches[i];
            }
        } else {
            original = event;
        }
        if (original === null) return null;

        const rect = xnode.element.getBoundingClientRect();
       
        let scaleX = 1.0;
        let scaleY = 1.0;
        if (xnode.element.tagName.toLowerCase() === 'canvas' && Number.isFinite(xnode.element.width) && Number.isFinite(xnode.element.height)) {
            scaleX = xnode.element.width / rect.width;
            scaleY = xnode.element.height / rect.height;
        }
        return { x: scaleX * (original.clientX - rect.left), y: scaleY * (original.clientY - rect.top) };
    }
}
