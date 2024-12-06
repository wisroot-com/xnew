import { xnew } from '../core/xnew';

export function ScaleEvent(xnode) {
    const base = xnew();

    // prevent touch default event
    base.on('touchstart', (event) => {
        event.preventDefault();
    });

    base.on('wheel', (event) => {
        xnode.emit('scale', event, { type: 'scale', scale: (event.deltaY > 0 ? 0.9 : 1.1), });
    }, { passive: false });

    const map = new Map();
    let valid = false;
    base.on('pointerdown', (event) => {
        const id = event.pointerId;
        valid = map.size === 1 ? true : false;

        const rect = xnode.element.getBoundingClientRect();
        const position = getPosition(event, rect);
        map.set(id, position);

        const xwin = xnew(window);
        xwin.on('pointermove', (event) => {
            if (event.pointerId === id) {
                const position = getPosition(event, rect);
                if (valid === true) {
                    const prev = map.get(id);
                    map.delete(id);
                    if (map.size === 1) {
                        const zero = [...map.values()][0]; 
                        const a = { x: prev.x - zero.x, y: prev.y - zero.y };
                        const b = { x: position.x - prev.x, y: position.y - prev.y };
                        const s =  a.x * a.x + a.y * a.y;
                        if (s > 0.0) {
                            const scale = 1 + (a.x * b.x + a.y * b.y) / s;
                            xnode.emit('scale', event, { type: 'scale', scale, });
                        }

                    }
                }
                map.set(id, position);
            }
        });

        xwin.on('pointerup pointercancel', (event) => {
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
