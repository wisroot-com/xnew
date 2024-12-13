import { xnew } from '../core/xnew';
import { DragEvent } from './DragEvent';

export function GestureEvent(xnode) {
    const drag = xnew(DragEvent);

    let active = false;
    const map = new Map();

    drag.on('down', (event, { position }) => {
        const id = event.pointerId;
        map.set(id, { ...position });
      
        active = map.size === 2 ? true : false;
        if (active === true) {
            xnode.emit('down', event, { type: 'down', });
        }
    });

    drag.on('move', (event, { position, delta }) => {
        const id = event.pointerId;
        if (active === true) {
            const a = map.get(id);
            map.delete(id);
            const b = [...map.values()][0]; 

            const v = { x: a.x - b.x, y: a.y - b.y };
            const s =  v.x * v.x + v.y * v.y;
            const scale = 1 + (s > 0.0 ? (v.x * delta.x + v.y * delta.y) / s : 0);
            xnode.emit('move', event, { type: 'move', scale, });
        }
        map.set(id, { ...position });
    });

    drag.on('up cancel', (event, { type }) => {
        const id = event.pointerId;
        if (active === true) {
            xnode.emit(type, event, { type, });
        }
        active = false;
        map.delete(id);
    });
}