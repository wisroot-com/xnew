import { xnew } from '../core/xnew';

export function ScaleEvent(xnode) {
    const base = xnew();

    // prevent touch default event
    base.on('touchstart', (event) => {
        event.preventDefault();
    });

    base.on('wheel', (event) => {
        xnode.emit('scale', event, { type: 'scale', scale: (event.deltaY > 0 ? +0.1 : -0.1), });
    }, { passive: false });

    const pmap = new Map();
    let valie = false;
    base.on('pointerdown', (event) => {
        const id = event.pointerId;
        valid = pmap.size === 1 ? true : false;

        const position = getPosition(event);
        pmap.set(id, position);

        const xwin = xnew(window);
        xwin.on('pointermove', (event) => {
            if (event.pointerId === id) {
                const position = getPosition(event);
                document.querySelector('#log').textContent = 'debug'+ pmap.size;
                if (valid === true) {
                    const prev = pmap.get(id);
                    pmap.delete(id);
                    const zero = pmap.values()[0]; 
                    const a = { x: prev.x - zero.x, y: prev.y - zero.y };
                    const b = { x: position.x - prev.x, y: position.y - prev.y };
                    const s =  a.x * a.x + a.y * a.y;
                    if (s > 0.0) {
                        const scale = (a.x * b.x + a.y * b.y) / s;
                        xnode.emit('scale', event, { type: 'scale', scale, });
                    }
                }
                pmap.set(id, position);
            }
        });

        xwin.on('pointerup pointercancel', (event) => {
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
