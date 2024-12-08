import { xnew } from '../core/xnew';

export function PointerEvent(xnode) {
    const base = xnew();

    // prevent touch default event
    // base.on('touchstart', (event) => {
    //     event.preventDefault();
    // });

    base.on('wheel', (event) => {
        xnode.emit('scale', event, { type: 'scale', scale: 1 + 0.001 * event.wheelDeltaY });
    }, { passive: false });

    const map = new Map();
    let drag = false;
    let scale = false;

    base.on('pointerdown', (event) => {
        const id = event.pointerId;
        drag = map.size === 0 ? true : false;
        scale = map.size === 1 ? true : false;
        
        const rect = xnode.element.getBoundingClientRect();
        const position = getPosition(event, rect);
        map.set(id, position);

        xnode.emit('down', event, { type: 'down', position, });

        const xwin = xnew(window);
        xwin.on('pointermove', (event) => {
            if (event.pointerId === id) {
                const position = getPosition(event, rect);
                const delta = { x: position.x - map.get(id).x, y: position.y - map.get(id).y };
                if (drag === true) {
                    xnode.emit('dragmove', event, { type: 'dragmove', position, delta, });
                }
                if (scale === true) {
                    const prev = map.get(id);
                    map.delete(id);
                    if (map.size === 1) {
                        const zero = [...map.values()][0]; 
                        const a = { x: prev.x - zero.x, y: prev.y - zero.y };
                        const s =  a.x * a.x + a.y * a.y;
                        if (s > 0.0) {
                            const scale = 1 + (a.x * delta.x + a.y * delta.y) / s
                            xnode.emit('scale', event, { type: 'scale', scale, });
                        }

                    }
                }
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
