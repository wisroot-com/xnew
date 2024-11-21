import { xnew } from '../core/xnew';

export function DragEvent(xnode) {
    const base = xnew();

    let id = null;
    let current = null;
    
    base.on('pointerdown', down);

    // prevent touch default event
    base.on('touchstart', (event) => {
        event.preventDefault();
    });

    function down(event) {
        const position = getPosition(event, id = getId(event));
        current = position;

        const type = 'down';
        xnode.emit(type, event, { type, position, });
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
    };
    function move(event) {
        const position = getPosition(event, id);
        if (position === null) return;

        const delta = { x: position.x - current.x, y: position.y - current.y };
        current = position;

        const type = 'move';
        xnode.emit(type, event, { type, position, delta, });
    };
    function up(event) {
        const position = getPosition(event, id);
        if (position === null) return;
        
        const type = 'up';
        xnode.emit(type, event, { type, position, });
        id = null;
        current = null;
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
    };

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

    return {
        finalize() {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
        }
    }
}
