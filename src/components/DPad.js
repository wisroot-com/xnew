import { xnew, xnest } from '../core/xnew';
import { PointerEvent } from './PointerEvent';

export function DPad(xnode, { size = 130, fill = '#FFF', fillOpacity = 0.8, stroke = '#000', strokeOpacity = 0.8, strokeWidth = 2 } = {}) {
    xnest({ style: `position: relative; width: ${size}px; height: ${size}px; cursor: pointer; overflow: hidden; user-select: none;`, });

    const fillStyle = `fill: ${fill}; fill-opacity: ${fillOpacity};`;
    const strokeStyle = `stroke: ${stroke}; stroke-opacity: ${strokeOpacity}; stroke-width: ${strokeWidth / (size / 100)}; stroke-linejoin: round;`;

    const polygons = [
        '<polygon points="50 50 35 35 35  5 37  3 63  3 65  5 65 35"></polygon>',
        '<polygon points="50 50 35 65 35 95 37 97 63 97 65 95 65 65"></polygon>',
        '<polygon points="50 50 35 35  5 35  3 37  3 63  5 65 35 65"></polygon>',
        '<polygon points="50 50 65 35 95 35 97 37 97 63 95 65 65 65"></polygon>'
    ];

    const targets = polygons.map((polygon) => {
        return xnew({
            tagName: 'svg',
            style: `position: absolute; width: 100%; height: 100%; user-select: none; ${fillStyle}"`,
            viewBox: '0 0 100 100'
        }, polygon);
    });
    
    xnew({ tagName: 'svg', style: `position: absolute; width: 100%; height: 100%; user-select: none; fill: none; ${strokeStyle}"`, viewBox: '0 0 100 100' }, `
        <polyline points="35 35 35  5 37  3 63  3 65  5 65 35"></polyline>
        <polyline points="35 65 35 95 37 97 63 97 65 95 65 65"></polyline>
        <polyline points="35 35  5 35  3 37  3 63  5 65 35 65"></polyline>
        <polyline points="65 35 95 35 97 37 97 63 95 65 65 65"></polyline>
        <polygon points="50 11 42 20 58 20"></polygon>
        <polygon points="50 89 42 80 58 80"></polygon>
        <polygon points="11 50 20 42 20 58"></polygon>
        <polygon points="89 50 80 42 80 58"></polygon>
    `);

    const pointer = xnew(PointerEvent);

    pointer.on('down dragmove', (event, { type, position }) => {
        const x = position.x - size / 2;
        const y = position.y - size / 2;
        const a = (y !== 0 || x !== 0) ? Math.atan2(y, x) : 0;
        const d = Math.min(1.0, Math.sqrt(x * x + y * y) / (size / 4));

        const vector = { x: Math.cos(a) * d, y: Math.sin(a) * d };
        vector.x = Math.abs(vector.x) > 0.5 ? Math.sign(vector.x) : 0;
        vector.y = Math.abs(vector.y) > 0.5 ? Math.sign(vector.y) : 0;
        targets[0].element.style.filter = (vector.y < 0) ? 'brightness(90%)' : '';
        targets[1].element.style.filter = (vector.y > 0) ? 'brightness(90%)' : '';
        targets[2].element.style.filter = (vector.x < 0) ? 'brightness(90%)' : '';
        targets[3].element.style.filter = (vector.x > 0) ? 'brightness(90%)' : '';
        xnode.emit(type, event, { type, vector });
    });

    pointer.on('dragup', (event, { type }) => {
        const vector = { x: 0, y: 0 };
        targets[0].element.style.filter = '';
        targets[1].element.style.filter = '';
        targets[2].element.style.filter = '';
        targets[3].element.style.filter = '';
        xnode.emit(type, event, { type, vector });
    });
}
